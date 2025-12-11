//! HTTP request handlers for the ASCII Art Generator backend
//!
//! This module contains all the route handlers for the REST API endpoints.

pub mod health;
pub mod nft;

use actix_web::HttpResponse;

/// Root endpoint handler
pub async fn root() -> HttpResponse {
    HttpResponse::Ok().body("ASCII Art Generator Backend (Rust)")
}

