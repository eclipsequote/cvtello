# cvtello
tello eduの制御、カメラ映像の取得と加工、Scratchとの連携を目的としたNodeアプリケーションです。
HTTPでユーザーからコマンドを受け取り、udp経由でtelloを制御します。
telloのビデオストリームはopencvでキャプチャされ、画像としてHTTP上に公開されます。
scratch3.0のTello Edu要拡張は[こちら](https://meowhal.github.io/scratch-gui/)

--