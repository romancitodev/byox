use miredis::resp::parse;

#[test]
fn cualquier_pedazo_es_incompleto() {
  // Por TCP llega lo que llega: cada prefijo de un valor tiene que pedir más bytes, sin error.
  let frames: [&[u8]; 4] = [b"+OK\r\n", b":-42\r\n", b"$5\r\nhello\r\n", b"*2\r\n$4\r\nECHO\r\n$4\r\nhola\r\n"];
  for frame in frames {
    for n in 0..frame.len() {
      assert_eq!(parse(&frame[..n]), Ok(None), "con los primeros {n} bytes de {:?}", String::from_utf8_lossy(frame));
    }
    assert!(matches!(parse(frame), Ok(Some((_, used))) if used == frame.len()));
  }
}

#[test]
fn bulk_largo_partido() {
  let mut raw = b"$1000\r\n".to_vec();
  raw.extend(std::iter::repeat_n(b'x', 999));
  assert_eq!(parse(&raw), Ok(None));
}
