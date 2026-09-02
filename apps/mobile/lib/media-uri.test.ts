import assert from 'node:assert/strict';
import test from 'node:test';
import { isRemoteMediaKey, localMediaUri } from './media-uri';

test('trata caminho de arquivo do Expo como local', () => {
  const capturada = 'file:///data/user/0/br.com.prumoq.app/files/prumoq-pending-media/photo_1.jpg';
  assert.equal(localMediaUri(capturada), capturada);
  assert.equal(isRemoteMediaKey(capturada), false);
});

test('remove o prefixo pending e preserva o esquema do arquivo', () => {
  assert.equal(
    localMediaUri('pending:file:///data/user/0/app/files/photo_2.jpg'),
    'file:///data/user/0/app/files/photo_2.jpg',
  );
});

test('aceita os demais esquemas locais das plataformas', () => {
  for (const uri of ['content://media/external/images/1', 'ph://ABC-123', 'assets-library://asset/1']) {
    assert.equal(localMediaUri(uri), uri, uri);
  }
});

test('caminho absoluto sem esquema continua local', () => {
  assert.equal(localMediaUri('/var/mobile/Containers/foto.jpg'), '/var/mobile/Containers/foto.jpg');
});

test('URLs já exibíveis passam direto', () => {
  assert.equal(localMediaUri('https://exemplo.com/f.jpg'), 'https://exemplo.com/f.jpg');
  assert.equal(localMediaUri('data:image/png;base64,AAA'), 'data:image/png;base64,AAA');
  assert.equal(localMediaUri('blob:http://localhost/abc'), 'blob:http://localhost/abc');
});

test('chave do R2 exige assinatura', () => {
  const chave = 'fotos/9f22acfa/a57fa44c/2026/09/uuid_photo.jpg';
  assert.equal(localMediaUri(chave), null);
  assert.equal(isRemoteMediaKey(chave), true);
});

test('valores vazios ou não-string não são chave remota', () => {
  for (const value of ['', null, undefined, 42, 'pending:']) {
    assert.equal(localMediaUri(value), null);
    assert.equal(isRemoteMediaKey(value), false);
  }
});
