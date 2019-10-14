# cvtello
tello eduの制御、カメラ映像の取得と加工、Scratchとの連携を目的としたNodeアプリケーションです。
HTTPでユーザーからコマンドを受け取り、udp経由でtelloを制御します。
telloのビデオストリームはopencvでキャプチャされ、画像としてHTTP上に公開されます。
scratch3.0のTello Edu要拡張は[こちら](https://meowhal.github.io/scratch-gui/)

--

https://gist.githubusercontent.com/Meowhal/57acccc4e2140d77eebc6ad7a11a93b1/raw/eef0a04c9bd782401c534a605047558f925bf8e5/csvdep.ps1
