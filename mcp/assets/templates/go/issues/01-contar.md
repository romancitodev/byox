## Objetivo

Contar las palabras de un texto, como hace `wc -w`. Es la base de todo lo que sigue.

## Contrato

En `wc.go`:

```go
func CountWords(text string) int
```

## Para descubrir

- ¿Qué pasa con dos espacios seguidos? ¿Y con un texto vacío?
- ¿Un tab o un salto de línea separan palabras?

## Hecho cuando

- [ ] `go test ./pasos/p01/` pasa.

## Para leer

- [`strings.Fields`](https://pkg.go.dev/strings#Fields)
