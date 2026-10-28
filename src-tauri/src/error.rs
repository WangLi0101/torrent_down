use serde::Serialize;
use std::fmt::{Display, Formatter};

pub type CmdResult<T> = Result<T, ApiError>;

#[derive(Debug, Clone, Serialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
}

impl ApiError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }

    pub fn invalid(message: impl Into<String>) -> Self {
        Self::new("InvalidInput", message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new("NotFound", message)
    }

    pub fn internal(error: impl Display) -> Self {
        Self::new("Internal", error.to_string())
    }
}

impl Display for ApiError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for ApiError {}

impl From<rusqlite::Error> for ApiError {
    fn from(value: rusqlite::Error) -> Self {
        Self::internal(value)
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(value: anyhow::Error) -> Self {
        Self::internal(format!("{value:#}"))
    }
}

impl From<std::io::Error> for ApiError {
    fn from(value: std::io::Error) -> Self {
        Self::internal(value)
    }
}
