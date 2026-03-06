# IPC

Esta pasta define a ponte entre renderer e processo principal no modo Electron.

## Responsabilidade

- registrar handlers `ipcMain`
- encaminhar chamadas do renderer para auth e rede
- retransmitir eventos de estado de autenticacao
- retransmitir eventos de streaming para a UI

## Arquivos

- [`register-ipc.ts`](./register-ipc.ts): registra e remove handlers IPC.
- [`channels.ts`](./channels.ts): utilitarios de broadcast para eventos compartilhados.

## Limite de Seguranca

O renderer nao acessa tokens, segredos nem requests diretas ao provider. Ele fala apenas com esta camada.

## Veja Tambem

- [main](../README.md)
- [preload](../../preload/README.md)
- [shared](../../shared/README.md)
