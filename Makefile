.DELETE_ON_ERROR :

.PHONY : clean all

all : dist/minimal.js

clean :
	rm -rf dist

dist:
	mkdir $@

dist/minimal.js : | dist
	cp samples/minimal/index.js $@
