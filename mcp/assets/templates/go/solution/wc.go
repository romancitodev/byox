package wc

import "strings"

// CountWords dice cuántas palabras tiene text. Ver issue #1.
func CountWords(text string) int {
	return len(strings.Fields(text))
}

// WordFrequencies dice cuántas veces aparece cada palabra, sin distinguir mayúsculas. Ver issue #2.
func WordFrequencies(text string) map[string]int {
	out := make(map[string]int)
	for _, w := range strings.Fields(text) {
		out[strings.ToLower(w)]++
	}
	return out
}
