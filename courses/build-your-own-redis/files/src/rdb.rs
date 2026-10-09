//! El formato RDB: el snapshot binario que Redis guarda en `dump.rdb`. Tramo de RDB.
//! https://rdb.fnordig.de/file_format.html
//! https://github.com/redis/redis/blob/unstable/src/rdb.h

/// El valor de una clave en el RDB.
#[derive(Clone, Debug, PartialEq)]
pub enum RdbValue {
  String(Vec<u8>),
  List(Vec<Vec<u8>>),
  Set(Vec<Vec<u8>>),
  Hash(Vec<(Vec<u8>, Vec<u8>)>),
  ZSet(Vec<(Vec<u8>, f64)>),
}

/// Una clave del RDB, con su vencimiento absoluto en milisegundos si tiene.
#[derive(Clone, Debug, PartialEq)]
pub struct Entry {
  pub key: Vec<u8>,
  pub value: RdbValue,
  pub expires_at_ms: Option<u64>,
}

/// Un archivo RDB leído.
#[derive(Clone, Debug, PartialEq)]
pub struct Rdb {
  /// La versión del encabezado `REDIS0011` → 11.
  pub version: u32,
  /// Los campos AUX (`redis-ver`, `ctime`, ...), en el orden en que aparecen.
  pub aux: Vec<(Vec<u8>, Vec<u8>)>,
  pub entries: Vec<Entry>,
}

/// Una longitud del RDB: un número, o el aviso de que sigue un string con codificación especial.
#[derive(Clone, Debug, PartialEq)]
pub enum Length {
  Len(u64),
  /// Los dos bits altos eran `11`: los seis de abajo dicen cómo está codificado el string.
  Encoded(u8),
}

#[derive(Debug, PartialEq)]
pub struct RdbError(pub String);

/// Lee una longitud desde el principio de `buf` y cuántos bytes ocupó.
pub fn read_length(buf: &[u8]) -> Result<(Length, usize), RdbError> {
  todo!("tramo de RDB")
}

/// Lee un archivo RDB completo.
pub fn load(data: &[u8]) -> Result<Rdb, RdbError> {
  todo!("tramo de RDB")
}

/// El CRC-64 (variante Jones) que Redis pone al final del RDB.
pub fn crc64(data: &[u8]) -> u64 {
  todo!("tramo de RDB")
}

/// Un archivo RDB con estas claves, que `load` y Redis pueden leer.
pub fn dump(entries: &[Entry]) -> Vec<u8> {
  todo!("tramo de RDB")
}
