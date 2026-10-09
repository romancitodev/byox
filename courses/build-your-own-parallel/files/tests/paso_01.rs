use rustminario::util::{XorShift, measure};

#[test]
fn misma_semilla_misma_secuencia() {
  let mut a = XorShift::new(42);
  let mut b = XorShift::new(42);
  for _ in 0..100 {
    assert_eq!(a.next_u64(), b.next_u64());
  }
}

#[test]
fn semilla_cero_no_se_traba() {
  let mut r = XorShift::new(0);
  let x = r.next_u64();
  let y = r.next_u64();
  assert_ne!(x, 0);
  assert_ne!(x, y, "con semilla 0 el generador devuelve siempre lo mismo: está trabado");
}

#[test]
fn valores_en_rango() {
  let v = XorShift::new(7).vec_i64(10_000, 100);
  assert_eq!(v.len(), 10_000);
  assert!(v.iter().all(|&x| (0..100).contains(&x)));
}

#[test]
fn medir_corre_f_las_veces_pedidas() {
  let mut llamadas = 0;
  measure(5, || llamadas += 1);
  assert_eq!(llamadas, 5);
}
