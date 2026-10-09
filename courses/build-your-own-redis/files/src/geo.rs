//! Coordenadas como scores de un sorted set, igual que GEOADD. Tramo de comandos geoespaciales.

/// El score de 52 bits que Redis guarda para una longitud y una latitud.
pub fn encode(longitude: f64, latitude: f64) -> u64 {
  todo!("tramo geoespacial")
}

/// La longitud y la latitud del centro de la celda que representa `score`.
pub fn decode(score: u64) -> (f64, f64) {
  todo!("tramo geoespacial")
}

/// La distancia en metros entre dos puntos, con la fórmula de haversine que usa Redis.
pub fn distance(lon1: f64, lat1: f64, lon2: f64, lat2: f64) -> f64 {
  todo!("tramo geoespacial")
}
