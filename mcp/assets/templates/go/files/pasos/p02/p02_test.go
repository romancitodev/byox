package p02

import (
	"maps"
	"testing"

	"example.com/wc"
)

func TestWordFrequencies(t *testing.T) {
	cases := map[string]map[string]int{
		"el gato y el perro": {"el": 2, "gato": 1, "y": 1, "perro": 1},
		"Hola hola HOLA":     {"hola": 3},
		"":                   {},
	}
	for text, want := range cases {
		if got := wc.WordFrequencies(text); !maps.Equal(got, want) {
			t.Errorf("WordFrequencies(%q) = %v, quería %v", text, got, want)
		}
	}
}
