# GLB -> self-contained glTF JSON (the binary chunk inlined as base64), for hosts
# that serve .json but not .glb. three.js GLTFLoader reads either.
#   python glb2json.py in.glb out.json
import json, struct, base64, sys
b = open(sys.argv[1], 'rb').read()
n = struct.unpack('<I', b[12:16])[0]
j = json.loads(b[20:20 + n])
off = 20 + n
bn = struct.unpack('<I', b[off:off + 4])[0]
binary = b[off + 8:off + 8 + bn]
j['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(binary).decode()
json.dump(j, open(sys.argv[2], 'w'), separators=(',', ':'))
