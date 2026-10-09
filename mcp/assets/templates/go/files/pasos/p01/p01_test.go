package p01

import (
	"testing"

	"example.com/wc"
)

func TestCountWords(t *testing.T) {
	cases := map[string]int{
		"hola mundo":                 2,
		"  el   gato\ty\nel perro  ": 5,
		"":                           0,
		"   \n":                      0,
	}
	for text, want := range cases {
		if got := wc.CountWords(text); got != want {
			t.Errorf("CountWords(%q) = %d, quería %d", text, got, want)
		}
	}
}
