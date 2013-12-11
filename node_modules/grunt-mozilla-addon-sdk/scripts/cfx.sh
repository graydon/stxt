#! /bin/bash

cd $1
source ./bin/activate
cd $2
COMMAND=$3
shift; shift; shift;
cfx $COMMAND $@
