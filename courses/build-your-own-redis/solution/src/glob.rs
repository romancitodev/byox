//! Patrones glob. Es la misma lógica que `stringmatchlen` en
//! https://github.com/redis/redis/blob/unstable/src/util.c, sin la opción de ignorar mayúsculas.

pub fn glob_match(pattern: &[u8], text: &[u8]) -> bool {
  let (mut p, mut s) = (0usize, 0usize);
  let (plen, slen) = (pattern.len(), text.len());
  while p < plen && s < slen {
    match pattern[p] {
      b'*' => {
        while p + 1 < plen && pattern[p + 1] == b'*' {
          p += 1;
        }
        if p + 1 == plen {
          return true;
        }
        return (s..slen).any(|start| glob_match(&pattern[p + 1..], &text[start..]));
      }
      b'?' => s += 1,
      b'[' => {
        p += 1;
        let negate = p < plen && pattern[p] == b'^';
        if negate {
          p += 1;
        }
        let mut matched = false;
        loop {
          if p + 1 < plen && pattern[p] == b'\\' {
            p += 1;
            if pattern[p] == text[s] {
              matched = true;
            }
          } else if p >= plen {
            // Un `[` sin cerrar: como en Redis, el patrón termina acá.
            p -= 1;
            break;
          } else if pattern[p] == b']' {
            break;
          } else if p + 2 < plen && pattern[p + 1] == b'-' {
            let (lo, hi) = (pattern[p].min(pattern[p + 2]), pattern[p].max(pattern[p + 2]));
            if (lo..=hi).contains(&text[s]) {
              matched = true;
            }
            p += 2;
          } else if pattern[p] == text[s] {
            matched = true;
          }
          p += 1;
        }
        if matched == negate {
          return false;
        }
        s += 1;
      }
      c => {
        let c = if c == b'\\' && p + 1 < plen {
          p += 1;
          pattern[p]
        } else {
          c
        };
        if c != text[s] {
          return false;
        }
        s += 1;
      }
    }
    p += 1;
    if s == slen {
      while p < plen && pattern[p] == b'*' {
        p += 1;
      }
      break;
    }
  }
  p == plen && s == slen
}
