// go run ./cmd/demo "el gato y el perro"
package main

import (
	"fmt"
	"os"
	"sort"

	"example.com/wc"
)

func main() {
	text := ""
	if len(os.Args) > 1 {
		text = os.Args[1]
	}
	fmt.Printf("%d palabras\n", wc.CountWords(text))
	freq := wc.WordFrequencies(text)
	words := make([]string, 0, len(freq))
	for w := range freq {
		words = append(words, w)
	}
	sort.Slice(words, func(i, j int) bool {
		if freq[words[i]] != freq[words[j]] {
			return freq[words[i]] > freq[words[j]]
		}
		return words[i] < words[j]
	})
	for _, w := range words {
		fmt.Printf("%3d %s\n", freq[w], w)
	}
}
