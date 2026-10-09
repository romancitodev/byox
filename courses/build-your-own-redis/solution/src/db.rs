//! Las claves y sus valores. Una sola base (la 0), protegida por el Mutex del servidor:
//! como en Redis, los comandos se ejecutan de a uno.

use std::collections::{HashMap, VecDeque};
use std::time::{SystemTime, UNIX_EPOCH};

pub fn now_ms() -> u64 {
  SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64
}

#[derive(Clone, Debug)]
pub enum Data {
  Str(Vec<u8>),
  List(VecDeque<Vec<u8>>),
}

impl Data {
  /// El nombre que devuelve TYPE.
  pub fn type_name(&self) -> &'static str {
    match self {
      Data::Str(_) => "string",
      Data::List(_) => "list",
    }
  }
}

#[derive(Clone, Debug)]
pub struct Item {
  pub data: Data,
  /// Vencimiento absoluto en milisegundos desde 1970.
  pub expires_at: Option<u64>,
}

impl Item {
  pub fn new(data: Data) -> Item {
    Item { data, expires_at: None }
  }
  pub fn expired(&self, now: u64) -> bool {
    self.expires_at.is_some_and(|t| t <= now)
  }
}

#[derive(Default)]
pub struct Db {
  pub items: HashMap<Vec<u8>, Item>,
  /// Los clientes bloqueados en BLPOP, en orden de llegada, por clave.
  pub blocked: HashMap<Vec<u8>, VecDeque<u64>>,
  pub next_waiter: u64,
  /// Estado del generador de números para muestrear claves en la expiración activa.
  rng: u64,
}

impl Db {
  /// La clave si existe y no venció. Si venció, la borra: es la expiración pasiva.
  pub fn live(&mut self, key: &[u8], now: u64) -> Option<&mut Item> {
    if self.items.get(key).is_some_and(|i| i.expired(now)) {
      self.items.remove(key);
    }
    self.items.get_mut(key)
  }

  pub fn exists(&mut self, key: &[u8], now: u64) -> bool {
    self.live(key, now).is_some()
  }

  /// Las claves vivas, en ningún orden en particular.
  pub fn live_keys(&mut self, now: u64) -> Vec<Vec<u8>> {
    self.items.retain(|_, i| !i.expired(now));
    self.items.keys().cloned().collect()
  }

  /// Una vuelta de expiración activa, como `activeExpireCycle` en expire.c: tomar 20 claves
  /// con vencimiento al azar, borrar las vencidas y repetir mientras más del 10% lo estaban.
  pub fn active_expire_cycle(&mut self, now: u64) {
    const KEYS_PER_LOOP: usize = 20;
    const ACCEPTABLE_STALE: usize = 10;
    loop {
      let with_ttl: Vec<&Vec<u8>> = self.items.iter().filter(|(_, i)| i.expires_at.is_some()).map(|(k, _)| k).collect();
      if with_ttl.is_empty() {
        return;
      }
      let mut sampled = Vec::with_capacity(KEYS_PER_LOOP);
      for _ in 0..KEYS_PER_LOOP.min(with_ttl.len()) {
        self.rng = xorshift(self.rng);
        sampled.push(with_ttl[(self.rng % with_ttl.len() as u64) as usize].clone());
      }
      sampled.sort();
      sampled.dedup();
      let total = sampled.len();
      let expired: Vec<Vec<u8>> = sampled.into_iter().filter(|k| self.items[k].expired(now)).collect();
      for k in &expired {
        self.items.remove(k);
      }
      if expired.len() * 100 <= total * ACCEPTABLE_STALE {
        return;
      }
    }
  }
}

fn xorshift(mut x: u64) -> u64 {
  if x == 0 {
    x = 0x9E37_79B9_7F4A_7C15;
  }
  x ^= x << 13;
  x ^= x >> 7;
  x ^= x << 17;
  x
}
