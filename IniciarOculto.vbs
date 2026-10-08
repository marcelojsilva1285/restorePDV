Set WshShell = CreateObject("WScript.Shell")
' O número 0 no final é o comando para "ocultar a janela"
WshShell.Run chr(34) & "server.exe" & Chr(34), 0
Set WshShell = Nothing