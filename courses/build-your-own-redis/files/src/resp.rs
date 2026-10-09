//! RESP2, el protocolo con el que hablan Redis y sus clientes. Etapas 1 a 12.
//! https://redis.io/docs/latest/develop/reference/protocol-spec/

/// Un valor de RESP2.
#[derive(Clone, Debug, PartialEq)]
pub enum Value {
  /// `+OK\r\n`
  Simple(String),
  /// `-ERR algo salió mal\r\n`
  Error(String),
  /// `:42\r\n`
  Integer(i64),
  /// `$4\r\nhola\r\n`. Puede tener cualquier byte adentro, incluso `\r\n`.
  Bulk(Vec<u8>),
  /// `$-1\r\n`: el "nil" de RESP2.
  NullBulk,
  /// `*2\r\n:1\r\n:2\r\n`
  Array(Vec<Value>),
  /// `*-1\r\n`
  NullArray,
}

/// Lo que se recibió no es RESP válido.
#[derive(Debug, PartialEq)]
pub struct ParseError(pub String);

/// Lee un valor desde el principio de `buf`.
///
/// - `Ok(Some((valor, n)))`: había un valor completo que ocupa los primeros `n` bytes.
/// - `Ok(None)`: todavía no llegó un valor completo; hay que esperar más bytes.
/// - `Err(_)`: los bytes no son RESP válido.
pub fn parse(buf: &[u8]) -> Result<Option<(Value, usize)>, ParseError> {
  todo!("etapas 1 a 11")
}

/// Los bytes de `value` en RESP2.
pub fn encode(value: &Value) -> Vec<u8> {
  todo!("etapa 12")
}
