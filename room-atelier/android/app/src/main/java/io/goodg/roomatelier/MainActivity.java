package io.goodg.roomatelier;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.*;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/* 해설: APK의 진입 화면입니다. 웹 편집기는 JavaScript, 안드로이드 창과 파일 선택·저장은 Java가 담당합니다. */
public final class MainActivity extends Activity {
    /* 해설: 이 HTTPS 주소는 외부 서버에 접속하는 주소가 아닙니다. LocalClient가 APK 안 assets/site의 파일로 응답합니다. */
private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/site/editor.html";
    private static final int OPEN_FILE = 11, SAVE_FILE = 12;
    /* 해설: 내보내기는 최대 120MB입니다. 별도 I/O 실행기로 저장 중 화면이 멈추는 일을 줄입니다. */
private static final long MAX_EXPORT = 120L * 1024 * 1024;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private WebView web;
    private ValueCallback<Uri[]> picker;
    private final ExportBridge exports = new ExportBridge();
    private boolean destroyed;

    /* 해설: 앱 시작: 이전 임시 파일 정리 → 화면 여백 처리 → WebView 설정 → 파일 선택 연결 → 로컬 편집기 열기 순서입니다. */
@Override public void onCreate(Bundle state) {
        super.onCreate(state);
        // Exports are temporary until the user chooses a destination.
        File[] stale = getCacheDir().listFiles((dir, name) -> name.startsWith("room-export-"));
        if (stale != null) for (File f : stale) f.delete();
        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(Color.rgb(251,250,247));
        container.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        web = new WebView(this);
        container.addView(web, new FrameLayout.LayoutParams(-1,-1));
        setContentView(container);
        /* 해설: 웹 편집기에 필요한 JavaScript·저장소는 켜고, 임의 파일 접근 및 혼합 콘텐츠는 제한합니다. */
WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setSafeBrowsingEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        web.setBackgroundColor(Color.rgb(251,250,247));
        web.setWebViewClient(new LocalClient());
        web.setWebChromeClient(new WebChromeClient() {
            /* 해설: HTML의 파일 입력 요청을 안드로이드 문서 선택 화면으로 연결합니다. glTF의 BIN·이미지도 여러 개 선택할 수 있습니다. */
@Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (picker != null) picker.onReceiveValue(null);
                picker = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { startActivityForResult(intent, OPEN_FILE); }
                catch (RuntimeException e) { picker.onReceiveValue(null); picker=null; notice("파일 선택 앱을 열 수 없습니다."); }
                return true;
            }
            @Override public boolean onJsAlert(WebView v, String url, String message, android.webkit.JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setTitle("룸 아틀리에").setMessage(message)
                    .setPositiveButton("확인", (d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();
                return true;
            }
        });
        /* 해설: 웹 코드가 window.RoomAndroid.begin/chunk/finish를 호출할 수 있게 Java 객체를 연결합니다. 아래 로컬 콘텐츠만 실행하도록 제한한 이유입니다. */
web.addJavascriptInterface(exports, "RoomAndroid");
        web.loadUrl(START);
    }

    /* 해설: 허용한 스킴·호스트·경로만 앱 내부 문서로 인정합니다. */
private static boolean local(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost())
            && uri.getPort() == -1 && uri.getUserInfo() == null
            && uri.getPath() != null && uri.getPath().startsWith("/assets/site/");
    }
    /* 해설: 파일 확장자에 맞는 Content-Type을 반환합니다. 모듈 JavaScript와 WebAssembly를 불러올 때도 필요합니다. */
private static String mime(String p) {
        if(p.endsWith(".html"))return "text/html";
        if(p.endsWith(".js"))return "text/javascript";
        if(p.endsWith(".css"))return "text/css";
        if(p.endsWith(".json"))return "application/json";
        if(p.endsWith(".wasm"))return "application/wasm";
        if(p.endsWith(".png"))return "image/png";
        if(p.endsWith(".jpg")||p.endsWith(".jpeg"))return "image/jpeg";
        if(p.endsWith(".svg"))return "image/svg+xml";
        if(p.endsWith(".woff2"))return "font/woff2";
        return "application/octet-stream";
    }
    private WebResourceResponse denied() {
        return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
    }
    /* 해설: WebView의 요청을 가로채 AssetManager로 APK 내 파일을 읽습니다. 외부 이동, 상위 경로 접근, GET 이외 요청은 차단합니다. */
private final class LocalClient extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest r) { return !local(r.getUrl()); }
        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest r) {
            Uri u=r.getUrl();
            if(!local(u)||!"GET".equals(r.getMethod()))return denied();
            String p=u.getPath().substring("/assets/".length());
            if(p.contains("..")||p.contains("\\"))return denied();
            if(p.endsWith("/"))p+="index.html";
            try {
                Map<String,String> headers=new HashMap<>();
                headers.put("Cache-Control","no-store");
                headers.put("X-Content-Type-Options","nosniff");
                headers.put("Content-Security-Policy","default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' blob: data:; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'");
                return new WebResourceResponse(mime(p),"UTF-8",200,"OK",headers,getAssets().open(p));
            } catch(IOException e) { return denied(); }
        }
    }

    private void notice(String message) { runOnUiThread(()->{if(!destroyed)Toast.makeText(this,message,Toast.LENGTH_LONG).show();}); }
    /* 해설: 네이티브 저장 결과를 토스트와 JavaScript CustomEvent로 알려 웹 화면의 상태 표시를 갱신합니다. */
private void exportResult(boolean success, String message) {
        notice(message);
        runOnUiThread(()->{if(!destroyed)web.evaluateJavascript("window.dispatchEvent(new CustomEvent('android-export-result',{detail:{success:"+success+",message:"+org.json.JSONObject.quote(message)+"}}))",null);});
    }
    /* 해설: 웹의 Blob을 임시 파일로 받는 중계 객체입니다. synchronized로 전송 상태에 대한 동시 접근을 보호합니다. */
public final class ExportBridge {
        private File file;
        private FileOutputStream stream;
        private String token, name, type;
        private long expected, written;
        private boolean waiting, copying;
        /* 해설: 1단계: 파일명·확장자·길이를 검사하고 임시 파일과 고유 토큰을 만듭니다. 빈 토큰은 거절을 뜻합니다. */
@JavascriptInterface public synchronized String begin(String filename, String contentType, long length) {
            if(file!=null||length<0||length>MAX_EXPORT)return "";
            try {
                name=filename.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]","_");
                if(name.isEmpty()||name.length()>160)return "";
                if(!(name.endsWith(".json")||name.endsWith(".glb")||name.endsWith(".png")))return "";
                type=name.endsWith(".png")?"image/png":name.endsWith(".json")?"application/json":"model/gltf-binary";
                file=File.createTempFile("room-export-",".tmp",getCacheDir());
                stream=new FileOutputStream(file);token=UUID.randomUUID().toString();expected=length;written=0;waiting=false;
                return token;
            } catch(IOException e) { reset();return ""; }
        }
        /* 해설: 2단계: 같은 토큰으로 온 Base64 청크를 디코딩해 씁니다. 청크 크기와 총 바이트 수를 검사합니다. */
@JavascriptInterface public synchronized boolean chunk(String id, String data) {
            if(!Objects.equals(token,id)||stream==null||data.length()>65536)return false;
            try { byte[] bytes=Base64.decode(data,Base64.NO_WRAP);if(written+bytes.length>expected)return false;stream.write(bytes);written+=bytes.length;return true; }
            catch(IOException|IllegalArgumentException e){reset();return false;}
        }
        /* 해설: 3단계: 예상 길이와 실제 길이가 같으면 스트림을 닫고 저장 위치 선택 화면을 엽니다. 이 반환값만으로 저장 성공이 확정되지는 않습니다. */
@JavascriptInterface public synchronized boolean finish(String id) {
            if(!Objects.equals(token,id)||stream==null||written!=expected)return false;
            try { stream.close();stream=null;waiting=true; }
            catch(IOException e){reset();return false;}
            runOnUiThread(()->{
                if(destroyed){reset();return;}
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(type).putExtra(Intent.EXTRA_TITLE,name);
                try { startActivityForResult(intent,SAVE_FILE); }
                catch(RuntimeException e){reset();exportResult(false,"파일 저장 화면을 열 수 없습니다.");}
            });
            return true;
        }
        /* 해설: 전송 실패나 취소 시 해당 토큰의 임시 파일을 정리합니다. */
@JavascriptInterface public synchronized void abort(String id) {if(Objects.equals(token,id)&&!waiting)reset();}
        /* 해설: 스트림과 임시 파일을 정리하고 전송 상태를 초기화합니다. */
private synchronized void reset() {
            if(stream!=null)try{stream.close();}catch(IOException ignored){}
            if(file!=null)file.delete();file=null;stream=null;token=null;waiting=false;copying=false;
        }
        /* 해설: 사용자가 선택한 문서 URI로 바이트를 복사합니다. URI가 없으면 취소로 처리하고, 복사가 끝나면 웹에 결과를 알립니다. */
private synchronized void save(Uri uri) {
            if(!waiting||file==null)return;
            if(uri==null){reset();exportResult(false,"파일 저장을 취소했어요.");return;}
            File source=file;copying=true;
            io.execute(()->{
                try(InputStream in=new FileInputStream(source);OutputStream out=getContentResolver().openOutputStream(uri,"wt")) {
                    if(out==null)throw new IOException("Destination unavailable");
                    byte[] buffer=new byte[65536];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);out.flush();
                    exportResult(true,"파일을 저장했어요.");
                }catch(IOException|RuntimeException e){exportResult(false,"파일을 저장하지 못했어요. 저장 공간과 파일 권한을 확인해 주세요.");}
                finally{reset();}
            });
        }
        private synchronized void closeIfIdle(){if(!copying)reset();}
    }
    /* 해설: 파일 열기 결과는 WebView의 콜백으로, 저장 위치 선택 결과는 ExportBridge.save로 전달합니다. */
@Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if(request==OPEN_FILE&&picker!=null){
            ArrayList<Uri> selected=new ArrayList<>();
            if(result==RESULT_OK&&data!=null){ClipData clip=data.getClipData();if(clip!=null){for(int i=0;i<clip.getItemCount();i++)selected.add(clip.getItemAt(i).getUri());}else if(data.getData()!=null)selected.add(data.getData());}
            picker.onReceiveValue(selected.isEmpty()?null:selected.toArray(new Uri[0]));picker=null;
        } else if(request==SAVE_FILE)exports.save(result==RESULT_OK&&data!=null?data.getData():null);
    }
    /* 해설: 뒤로 가기: 열린 모달 닫기 → 모바일 속성 패널 닫기 → 웹 방문 기록 → 앱 종료 확인 순서입니다. */
@Override public void onBackPressed() {
        web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){const b=d.querySelector('#builder-close,#close-import,#outline-close');if(b)b.click();else d.close();return true}const p=document.querySelector('.inspector-panel.mobile-open');if(p){p.classList.remove('mobile-open');return true}return false})()",value->{
            if("true".equals(value))return;
            if(web.canGoBack())web.goBack();
            else new AlertDialog.Builder(this).setTitle("앱을 종료할까요?").setMessage("변경한 방은 ‘공간 저장’을 눌러 보관해 주세요.").setNegativeButton("계속 편집",null).setPositiveButton("종료",(d,w)->finish()).show();
        });
    }
    /* 해설: 앱 수명 주기에 맞춰 WebView를 일시 정지·재개하고, 종료 시 콜백·중계 객체·WebView 자원을 정리합니다. */
@Override protected void onPause(){super.onPause();web.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override protected void onDestroy(){destroyed=true;if(picker!=null)picker.onReceiveValue(null);exports.closeIfIdle();io.shutdown();if(web!=null){web.removeJavascriptInterface("RoomAndroid");web.destroy();}super.onDestroy();}
}
