
clean:
	rm -Rf ministore-stxt-node test.log
	find . -name \*~ | xargs rm

check:
	node node-test-runner.js | tee test.log
