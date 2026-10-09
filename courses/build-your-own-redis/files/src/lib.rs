//! Tu propio Redis, desde el socket hasta la replicación.
//!
//! Cada módulo corresponde a una parte del curso. Los tests de `tests/` usan solo lo que
//! está acá como `pub`; adentro de cada módulo podés organizar el código como quieras y
//! agregar los módulos privados que necesites.

// Los stubs con `todo!()` no usan sus parámetros. Borrá esta línea cuando quieras ver esos avisos.
#![allow(unused_variables)]

pub mod config;
pub mod geo;
pub mod glob;
pub mod rdb;
pub mod resp;
pub mod server;

pub use config::Config;
pub use server::Server;
