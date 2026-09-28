"""Repackage the supplied native Android shell with updated offline assets; sign APK v2.
The original DEX is reused unchanged. No SDK/network dependency for this rebuild.
"""
from pathlib import Path
import zipfile,struct,hashlib,datetime,os
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import serialization,hashes
from cryptography.hazmat.primitives.asymmetric import rsa,padding
R=Path(__file__).resolve().parent
u32=lambda n:struct.pack('<I',n)
u64=lambda n:struct.pack('<Q',n)
lp=lambda b:u32(len(b))+b

# AndroidManifest.xml은 일반 XML이 아니라 Android 이진 XML입니다.
# 문자열 풀을 재작성해 별도 패키지명·실행 Activity·앱 표시 이름을 설정합니다.
# DEX 내부 Java 패키지는 바뀌지 않으므로 Activity에는 기존 전체 클래스명을 사용합니다.
def manifest(b):
 out=[];off=8;strings=[]
 while off<len(b):
  typ,h,size=struct.unpack_from('<HHI',b,off);chunk=bytearray(b[off:off+size])
  if typ==1:
   count,styles,flags,start,sty=struct.unpack_from('<5I',chunk,8)
   assert flags==0 and styles==0
   for i in range(count):
    p=start+struct.unpack_from('<I',chunk,h+4*i)[0];n=struct.unpack_from('<H',chunk,p)[0];strings.append(bytes(chunk[p+2:p+2+n*2]).decode('utf-16le'))
   strings=[{'io.goodg.roomatelier':'io.goodg.roomatelier.autosave','.MainActivity':'io.goodg.roomatelier.MainActivity','1.0.0':'1.2.0'}.get(s,s) for s in strings]
   strings.append('룸 아틀리에 · 자동저장');count=len(strings)
   data=b'';offsets=[]
   for s in strings:offsets.append(len(data));data+=struct.pack('<H',len(s))+s.encode('utf-16le')+b'\0\0'
   data+=b'\0'*((-len(data))%4)
   chunk=bytearray(struct.pack('<HHI5I',1,28,28+4*count+len(data),count,0,0,28+4*count,0)+b''.join(u32(i) for i in offsets)+data)
  elif typ==0x102:
   attrStart,attrSize,attrCount=struct.unpack_from('<HHH',chunk,24)
   for i in range(attrCount):
    p=16+attrStart+i*attrSize;name=struct.unpack_from('<I',chunk,p+4)[0]
    if strings[name]=='versionCode':struct.pack_into('<I',chunk,p+16,2)
    if strings[name]=='label' and strings[struct.unpack_from('<I',chunk,20)[0]]=='application':
     struct.pack_into('<I',chunk,p+8,len(strings)-1);chunk[p+15]=3;struct.pack_into('<I',chunk,p+16,len(strings)-1)
  out.append(chunk);off+=size
 body=b''.join(out);return struct.pack('<HHI',3,8,8+len(body))+body

# 원본 APK의 DEX/리소스를 보존하고 웹 파일을 교체한 후 APK v2로 서명합니다.
# Java를 수정했다면 이 경로로 반영되지 않으므로 SDK 전체 빌드가 필요합니다.
def build():
 original=R/'native-shell.zip';unsigned=R/'unsigned.apk';out=R/'room-atelier-android-1.2.0.apk'
 with zipfile.ZipFile(original) as src,zipfile.ZipFile(unsigned,'w') as z:
  items=[]
  for name in src.namelist():
   if name.startswith(('assets/','META-INF/')):continue
   data=src.read(name)
   if name=='AndroidManifest.xml':data=manifest(data)
   items.append((name,data))
  for p in sorted((R/'app/src/main/assets').rglob('*')):
   if p.is_file():items.append(('assets/'+p.relative_to(R/'app/src/main/assets').as_posix(),p.read_bytes()))
  for name,data in items:
   info=zipfile.ZipInfo(name,(2026,9,27,0,0,0));info.compress_type=zipfile.ZIP_STORED if name=='resources.arsc' else zipfile.ZIP_DEFLATED
   if info.compress_type==zipfile.ZIP_STORED:
    pad=(- (z.fp.tell()+30+len(name.encode())+4))%4;info.extra=struct.pack('<HH',0xd935,pad)+b'\0'*pad
   z.writestr(info,data)
 # 서명키는 재실행 때 재사용합니다. 이 배포 소스에는 실제 개인키가 없습니다.
 keydir=R/'.signing';keydir.mkdir(exist_ok=True);keypath=keydir/'release.pem';certpath=keydir/'release.der'
 if not keypath.exists():
  key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
  keypath.write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()));os.chmod(keypath,0o600)
  name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'Room Atelier Android')]);now=datetime.datetime.now(datetime.timezone.utc)
  cert=x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-datetime.timedelta(days=1)).not_valid_after(now+datetime.timedelta(days=10000)).sign(key,hashes.SHA256());certpath.write_bytes(cert.public_bytes(serialization.Encoding.DER))
 key=serialization.load_pem_private_key(keypath.read_bytes(),None);cert=certpath.read_bytes();b=unsigned.read_bytes();e=b.rfind(b'PK\x05\x06');cd=struct.unpack_from('<I',b,e+16)[0]
 # v2 무결성 해시는 파일 내용·중앙 디렉터리·EOCD를 1MiB 조각으로 계산합니다.
 parts=[b[:cd],b[cd:e],b[e:]];ds=[]
 for part in parts:
  for i in range(0,len(part),1048576):
   chunk=part[i:i+1048576];ds.append(hashlib.sha256(b'\xa5'+u32(len(chunk))+chunk).digest())
 digest=hashlib.sha256(b'\x5a'+u32(len(ds))+b''.join(ds)).digest();alg=u32(0x0103)
 signed=lp(lp(alg+lp(digest)))+lp(lp(cert))+lp(b'')
 sig=key.sign(signed,padding.PKCS1v15(),hashes.SHA256());pub=key.public_key().public_bytes(serialization.Encoding.DER,serialization.PublicFormat.SubjectPublicKeyInfo)
 signer=lp(signed)+lp(lp(alg+lp(sig)))+lp(pub);value=lp(lp(signer));pair=u64(4+len(value))+u32(0x7109871a)+value
 size=len(pair)+24;block=u64(size)+pair+u64(size)+b'APK Sig Block 42';eo=bytearray(b[e:]);struct.pack_into('<I',eo,16,cd+len(block))
 out.write_bytes(b[:cd]+block+b[cd:e]+eo)
 with zipfile.ZipFile(out) as z:assert z.testzip() is None
 print(out);print('SHA256',hashlib.sha256(out.read_bytes()).hexdigest())
if __name__=='__main__':build()
