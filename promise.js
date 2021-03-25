function MyPromise (executor) {
    this.status = 'pending';
    this.value = null;
    this.reason = null;
    // 用来存储多个回调函数
    // eg：
    // let p = new MyPromise();
    // p.then(onFulfiled1, onRejected1);
    // p.then(onFulfiled2, onRejected2);
    this.onFulfilledStack = [];
    this.onRejectedStack = [];

    // 有的时候我们会写出如下代码：
    // Promise.resolve(1).then(value=>console.log(value);
    // console.log(2);
    // 如果
    // resolve 和 reject 方法里采用 setTimeout 进行包裹
    const resolve = (x) => {
        setTimeout(() => {
            if (this.status === 'pending') {
                this.status = 'fulfilled';
                this.value = x;
                while (this.onFulfilledStack.length > 0) {
                    this.onFulfilledStack.shift()(x);
                }
            }
        })

    }

    const reject = (reason) => {
        setTimeout(() => {
            if (this.status === 'pending') {
                this.reason = reason;
                this.status = 'rejected';
                while (this.onRejectedStack.length > 0) {
                    this.onRejectedStack.shift()(reason);
                }
            }
        })

    }

    try {
        executor(resolve, reject);
    } catch (err) {
        reject(err)
    }

}

MyPromise.prototype.then = function (onFulfilled, onRejected) {
    let currentPromise;

    // 设置默认的回调方法（需原样返回传进来的值或者抛出同样的值），可以保证 promise 结果能够透传
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : value => value;
    onRejected = typeof onRejected === 'function' ? onRejected : reason => { throw reason }

    // 规范规定 then 方法需要返回一个 promise ，但是这里不能返回 this。
    // 因为 this 指当前 promise 实例，当 onFulfilled 或者 onRejected 方法执行的时候，
    // 实例的状态已经变成了 fulfiled 或者 rejected，并且不能改变
    // 就会导致链式调用时，后面 then 方法的实参方法得到的值都会是当前实例的值
    // 所以需要返回一个新的 promise
    return currentPromise = new MyPromise((resolve, reject) => {

        // 因为 onFulfilled(this.value) 和 onRejected(this.reason) 可能会返回一个 thenable 对象，
        // 而当前 then 的状态需要 thenable 来决定，所以将下方的代码移到返回的新 promise 内去等待状态改变
        if (this.status === 'pending') {
            this.onFulfilledStack.push(value => {
                setTimeout(() => {
                    try {
                        let x = onFulfilled(this.value);
                        resolvePromise(currentPromise, x, resolve, reject)
                    } catch (err) {
                        reject(err)
                    }
                })

            })
            this.onRejectedStack.push(reason => {
                setTimeout(() => {
                    try {
                        let x = onRejected(this.reason);
                        resolvePromise(currentPromise, x, resolve, reject)
                    } catch (err) {
                        reject(err)
                    }
                })

            })
        }

        if (this.status === 'fulfilled') {
            setTimeout(() => {
                try {
                    let x = onFulfilled(this.value);
                    resolvePromise(currentPromise, x, resolve, reject)
                } catch (err) {
                    reject(err)
                }
            })
        }

        if (this.status === 'rejected') {
            setTimeout(() => {
                try {
                    let x = onRejected(this.reason);
                    resolvePromise(currentPromise, x, resolve, reject)
                } catch (err) {
                    reject(err)
                }
            })

        }
    });
}

// Promise resolution procedure
// x 是上一个 promise 回调实参 onFulfilled 或者 onRejected 返回的值，
// 标准规定，x 既可以是普通值，也可以是一个 thenable，因此需要分别处理
function resolvePromise (promise_, x, resolve, reject) {
    // 2.3.1 如果 promise_ 和 x 是同一个对象，reject TypeError
    if (x === promise_) {
        return reject(new TypeError(`${x} should no refer to the same object with MyPromise`))
    }

    // 判断 then 方法中的 resolvePromise 和 rejectPromise 方法是否已经执行过
    let hasCalled = false;

    if (x instanceof MyPromise) {
        // 如果状态还未改变，那么需要继续调用 resolvePromise，等待状态改变
        if (x.status === 'pending') {
            x.then(y => {
                resolvePromise(promise_, y, resolve, reject)
            }, err => {
                reject(err);
            })
        } else {
            // 如果状态已经改变，那么 x 就会有一个正常值，假设为 z
            // 执行 x.then(resolve, reject)，会直接调用 resolve(z) 或者 reject(z) ：
            // 2.3.2.2 && 2.3.2.3
            x.then(resolve, reject);
        }
    } else if (Object.prototype.toString.call(x) === '[object Object]' || typeof x === 'function') {
        try {
            let then = x.then;
            if (typeof then === 'function') {
                then.call(x, y => {
                    // 2.3.3.3.3
                    if (hasCalled) {
                        return;
                    }
                    hasCalled = true;
                    // 2.3.3.3.1
                    resolvePromise(promise_, y, resolve, reject)
                }, err => {
                    // 2.3.3.3.3
                    if (hasCalled) {
                        return;
                    }
                    hasCalled = true;
                    // 2.3.3.3.2
                    reject(err);
                })
            } else {
                // 2.3.3.4
                resolve(x);
            }
        } catch (err) {
            // 2.3.3.3.4.1
            // if resolvePromise or rejectPromise have been called, ignore it.
            if (!hasCalled) {
                reject(err);
            }
        }
    } else {
        // 2.3.4
        resolve(x);
    }
}

MyPromise.prototype.resolve = function(value) {
    return new MyPromise((resolve, reject) => {
        resolve(value)
    })
}

MyPromise.prototype.catch = function (onRejected) {
    return this.then(null, onRejected);
}

MyPromise.prototype.finally = function (callback) {
    return this.then(callback, callback);
}

MyPromise.prototype.all = function (promiseArr) {
    let promise_all;
    return promise_all = new MyPromise((resolve, reject) => {
        let result = [];
        let resolveCount = 0;
        promiseArr.forEach((currentPromise, index) => {
            currentPromise.then(value => {
                result[index] = value;
                resolveCount++;
                if (resolveCount === promiseArr.length) {
                    resolve(result);
                }
            }, err => {
                reject(err)
            })
        })

    })
}

MyPromise.prototype.race = function (promiseArr) {
    let promise_all;
    return promise_all = new MyPromise((resolve, reject) => {
        promiseArr.forEach((currentPromise, index) => {
            currentPromise.then(value => {
                resolve(value);
            }, err => {
                reject(err)
            })
        })
    })
}

MyPromise.prototype.allSettled = function(promiseArr) {
    return new Promise((resolve, reject) => {
        let resultArr = [];
        promiseArr.forEach(currentPromise => {
            currentPromise.then(value => {
                resultArr.push({status: 'fulfilled', value: value});
                if (resultArr.length === promiseArr.length) {
                    resolve(resultArr);
                }
            }, err => {
                resultArr.push({status: 'rejected', reason: err});
                if (resultArr.length === promiseArr.length) {
                    resolve(resultArr);
                }
            })
        })
    })
}

MyPromise.prototype.any = function(promiseArr) {
    return new Promise((resolve, reject) => {
        let rejectCount = 0;
        promiseArr.forEach(currentPromise => {
            currentPromise.then(value => {
                resolve(value);
            }, err => {
                rejectCount ++;
                if (rejectCount === promiseArr.length) {
                    reject('AggregateError: All promises were rejected');
                }
            })
        })
    })
}

MyPromise.prototype.resolve = function (value) {
    return new MyPromise((resolve, reject) => {
        resolve(value);
    })
}

MyPromise.prototype.reject = function (reason) {
    return new MyPromise((resolve, reject) => {
        reject(reason);
    })
}


MyPromise.deferred = function () {
    const defer = {};
    defer.promise = new MyPromise((resolve, reject) => {
        defer.resolve = resolve;
        defer.reject = reject;
    })
    return defer;
}

try {
    module.exports = MyPromise
} catch (e) { }