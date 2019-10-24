class TestUtils {
  // async呼び出し用のディレイ関数
  delayAsync(ms: number): Promise<void> {
    if (ms == 0) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new TestUtils();