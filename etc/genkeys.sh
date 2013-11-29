#!/bin/sh
#
# generate a key for use signing chrome crx packages

openssl genrsa -out keypair.pem 1024
openssl pkcs8 -topk8 -in keypair.pem -inform pem -out key.pem -outform pem -nocrypt
