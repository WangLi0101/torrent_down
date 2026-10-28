use crate::models::PeerDiagnostic;
use std::collections::HashMap;
use std::time::Instant;

/// Samples payload counters, including data that has not completed piece verification yet.
pub struct TransferMonitor {
    last_sample: Instant,
    last_data: Instant,
    received_bytes: u64,
    peer_bytes: HashMap<String, u64>,
}

impl TransferMonitor {
    pub fn new(received_bytes: u64, now: Instant) -> Self {
        Self {
            last_sample: now,
            last_data: now,
            received_bytes,
            peer_bytes: HashMap::new(),
        }
    }

    pub fn sample(
        &mut self,
        received_bytes: u64,
        peers: &mut [(String, PeerDiagnostic)],
        now: Instant,
    ) -> u64 {
        if received_bytes != self.received_bytes {
            self.last_data = now;
        }
        if received_bytes < self.received_bytes {
            // Restarting a torrent resets its counters; don't compare different sessions.
            self.peer_bytes.clear();
        }
        let elapsed = now.duration_since(self.last_sample).as_secs_f64();
        for (address, peer) in peers.iter_mut() {
            peer.down_speed = self
                .peer_bytes
                .get(address)
                .filter(|previous| elapsed > 0.0 && peer.received_bytes >= **previous)
                .map(|previous| ((peer.received_bytes - previous) as f64 / elapsed) as u64)
                .unwrap_or(0);
        }
        self.peer_bytes = peers
            .iter()
            .map(|(address, peer)| (address.clone(), peer.received_bytes))
            .collect();
        self.last_sample = now;
        self.received_bytes = received_bytes;
        now.duration_since(self.last_data).as_secs()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn distinguishes_recent_transfer_from_historical_bytes() {
        let now = Instant::now();
        let mut monitor = TransferMonitor::new(4096, now);
        let mut peers = vec![(
            "peer".into(),
            PeerDiagnostic {
                received_bytes: 4096,
                ..Default::default()
            },
        )];
        monitor.sample(4096, &mut peers, now);
        assert_eq!(peers[0].1.down_speed, 0);
        assert_eq!(
            monitor.sample(4096, &mut peers, now + Duration::from_secs(30)),
            30
        );
        assert_eq!(peers[0].1.down_speed, 0);
        peers[0].1.received_bytes += 4096;
        assert_eq!(
            monitor.sample(8192, &mut peers, now + Duration::from_secs(32)),
            0
        );
        assert_eq!(peers[0].1.down_speed, 2048);
    }

    #[test]
    fn restart_and_reappearing_peer_do_not_produce_false_transfer_rates() {
        let now = Instant::now();
        let mut monitor = TransferMonitor::new(8192, now);
        let mut peers = vec![(
            "peer".into(),
            PeerDiagnostic {
                received_bytes: 8192,
                ..Default::default()
            },
        )];
        monitor.sample(8192, &mut peers, now);
        peers[0].1.received_bytes = 0;
        assert_eq!(
            monitor.sample(0, &mut peers, now + Duration::from_secs(2)),
            0
        );
        assert_eq!(peers[0].1.down_speed, 0);
        monitor.sample(0, &mut [], now + Duration::from_secs(4));
        peers[0].1.received_bytes = 100;
        monitor.sample(100, &mut peers, now + Duration::from_secs(6));
        assert_eq!(peers[0].1.down_speed, 0);
    }
}
