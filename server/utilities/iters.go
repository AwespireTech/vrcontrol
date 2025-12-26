package utilities

import "iter"

func Fold[T, U any](it iter.Seq[T], init U, f func(U, T) U) U {
	var acc = init
	for i := range it {
		acc = f(acc, i)
	}
	return acc
}
func Map[T, U any](it iter.Seq[T], f func(T) U) iter.Seq[U] {
	return func(yield func(U) bool) {
		n, s := iter.Pull(it)
		defer s()
		for {
			v, ok := n()
			if !ok {
				return
			}
			if !yield(f(v)) {
				return
			}
		}
	}
}
func Fold2[T, U, V any](it iter.Seq2[T, U], init V, f func(V, T, U) V) V {
	var acc = init
	for a, b := range it {
		acc = f(acc, a, b)
	}
	return acc
}
