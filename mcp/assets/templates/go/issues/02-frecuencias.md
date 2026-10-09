## Objetivo

Saber cuántas veces aparece cada palabra. Es el primer paso de cualquier índice o buscador.

## Contrato

En `wc.go`:

```go
func WordFrequencies(text string) map[string]int
```

## Reglas

- `Hola` y `hola` son la misma palabra.

## Hecho cuando

- [ ] `go test ./pasos/p02/` pasa.

## Para leer

- [Maps en Go](https://go.dev/blog/maps)
- [`strings.ToLower`](https://pkg.go.dev/strings#ToLower)
