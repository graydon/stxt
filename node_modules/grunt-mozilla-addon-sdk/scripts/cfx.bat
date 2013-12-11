cd %1
call bin\activate
cd %2
SET COMMAND=%3

SHIFT
SHIFT
SHIFT

SET args=
:LOOP
if !%1!==!! goto :END
SET args=%args% %1
SHIFT
goto LOOP
:END

cfx %COMMAND% %args%