/**
 * 每天统计每个用户的记账基本数据，包含字段：
1. 日期
2. 支出
3. 收入
4. 净资产
5. 记账次数
6. 用户openId
 */
const cloud = require('wx-server-sdk')

cloud.init()

const MAX_LIMIT = 100

// 云函数入口函数
exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  cloud.updateConfig({
    env: wxContext.ENV === 'local' ? 'release-wifo3' : wxContext.ENV,
  })
  // 初始化数据库
  const db = cloud.database({
    env: wxContext.ENV === 'local' ? 'release-wifo3' : wxContext.ENV,
  })
  // 获取所有user表保存的用户
  // 先取出集合记录总数
  const countUserResult = await db.collection('USERS').count()
  const { total } = countUserResult
  // 计算需分几次取
  const batchTimes = Math.ceil(total / 100)
  // 承载所有读操作的 promise 的数组
  const tasks = []
  for (let i = 0; i < batchTimes; i++) {
    const promise = db.collection('USERS').skip(i * MAX_LIMIT).limit(MAX_LIMIT).get()
    tasks.push(promise)
  }
  // 目前用户不多，一次查出来
  const userList = Promise.all(tasks)
  console.log('userList', userList)
  return {
    event,
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  }
}
