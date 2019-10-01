/**
 * 参考 Queue.js by Kate Morley - http://code.iamkate.com/
 * http://code.iamkate.com/javascript/queues/
 */

 /**
  * Queueの実装
  * Javascriptの配列はpushとshiftでキューとして利用できるが、
  * 配列のインデックス再配置が気になり、このクラスを用意した。
  * もちろんパフォーマンスチェックはしていない。
  */
export default class Queue<T> {
  private body = [];
  private offset = 0;

  get length(): number {
    return this.body.length - this.offset;
  }

  get isEmpty(): boolean {
    return this.body.length == 0;
  }

  get peek(): T | undefined {
    return this.isEmpty ? undefined : this.body[this.offset];
  }

  enqueue(item: T): void {
    this.body.push(item);
  }

  dequeue(): T | undefined {
    const item = this.peek;
    if (++this.offset * 2 >= this.body.length) {
      this.body = this.body.slice(this.offset);
      this.offset = 0;
    }
    return item;
  }
}