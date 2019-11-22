// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init();

//全局变量
const MAX_LIMIT = 100;//最大限制数

// 云函数入口函数
exports.main = async (event, context) => {
  const { mode,date } = event;
  let service = AccountChartService(mode, date);
  try {
      return await service.getAccountChart();
  } catch (e) {
    console.error(e);
    return {
      code: -1,
      data: [],
      message: '获取失败'
    }
  }

}
 
//账单图表service类 2019-11-12
var AccountChartService = function (mode,date,openId){
  var o = new Object();
  o.mode = mode;
  o.date = date;

  const wxContext = cloud.getWXContext();

  /**
   * 获取数据库连接对象
   */
  function getDBConnection() {
    //数据库对象
    const db = cloud.database({
      env: wxContext.ENV === 'local' ? 'release-wifo3' : wxContext.ENV
    });
    return {
      _: db.command,
      db: db,
      $: db.command.aggregate
    }
  }

  o.getAccountChart = function () {
    if (o.mode == "getAccountChartByMonth") {
      return o.getAccountChartByMonth();
    }
    if (o.mode == "getAccountChartByYear") {
      return o.getAccountChartByYear();
    }
    if (o.mode == "getAccountChartOfYear") {
      return o.getAccountChartOfYear();
    }
    return {
      code: -1,
      data: [],
      message: '未找到对应方法'
    }
  }

  o.getAccountChartByMonth =  async function () {
    const { _, db, $ } = await getDBConnection();
    const res = await db.collection('DANDAN_NOTE')
      .aggregate()
      .addFields({
        formatDate: $.dateToString({
          date: '$noteDate',
          format: '%Y-%m'
        }),
        noteDay: $.dateToString({
          date: '$noteDate',
          format: '%d'
        }),
        income: $.switch({
          branches: [
            { case: $.eq(['$flow', 1]), then: '$money' },
          ],
          default: 0
        }),
        expenses: $.switch({
          branches: [
            { case: $.eq(['$flow', 0]), then: $.multiply(['$money', -1]) },
          ],
          default: 0
        }),
      })
      .match({
        openId: wxContext.OPENID,
        formatDate: o.date,
        isDel : false
      })
      .group({
        _id: '$noteDay',
        income: $.sum('$income'),
        expenses: $.sum('$expenses'),
      })
      .project({
        _id: 0,
        noteDate: '$_id',
        income: 1,
        expenses: 1,
        netIncome: $.add(['$income', '$expenses'])
      })
      .sort({
        noteDate: 1,
      })
      .limit(32)
      .end()
      .then(res => {
        let resList = res.list;
        
        let lastDay = new Date(new Date(o.date).getFullYear(), new Date(o.date).getMonth()+1, 0).getDate();
        let resListSize = resList.length;
        let xAxisData = new Array();      //x轴数据
        var incomeData = new Array();     //收入数据
        var expensesData = new Array();   //支出数据
        var netIncomeData = new Array();  //净收入数据
        for (let i = 0, y = 0; i < lastDay; i++) {
          let day = i + 1;
          xAxisData.push(day + "日");
          //该日期存有账单数据
          if (y < resListSize && parseInt(resList[y].noteDate) === day) {
            incomeData.push(strip(resList[y].income));
            expensesData.push(strip(resList[y].expenses));
            netIncomeData.push(strip(resList[y].netIncome));
            y++;
          } else {
            incomeData.push(0);
            expensesData.push(0);
            netIncomeData.push(0);
          }
        }
        return _getChartData(xAxisData, incomeData, expensesData, netIncomeData);
      })
      .catch(err => {
        console.error(err);
        return {
          data: err,
          flag: 0
        };
      });
    return {
      code: 1,
      data: res,
      message: '查询账单图表数据成功',
    };

  }

  o.getAccountChartByYear = async function () {
    const { _, db, $ } = await getDBConnection();
    const res = await db.collection('DANDAN_NOTE')
      .aggregate()
      .addFields({
        formatDate: $.dateToString({
          date: '$noteDate',
          format: '%Y'
        }),
        noteMonth: $.dateToString({
          date: '$noteDate',
          format: '%m'
        }),
        income: $.switch({
          branches: [
            { case: $.eq(['$flow', 1]), then: '$money' },
          ],
          default: 0
        }),
        expenses: $.switch({
          branches: [
            { case: $.eq(['$flow', 0]), then: $.multiply(['$money', -1]) },
          ],
          default: 0
        }),
      })
      .match({
        openId: wxContext.OPENID,
        formatDate: o.date,
        isDel: false
      })
      .group({
        _id: '$noteMonth',
        income: $.sum('$income'),
        expenses: $.sum('$expenses'),
      })
      .project({
        _id: 0,
        noteMonth: '$_id',
        income: 1,
        expenses: 1,
        netIncome: $.add(['$income', '$expenses'])
      })
      .sort({
        noteMonth: 1,
      })
      .limit(13)
      .end()
      .then(res => {
        let resList = res.list;

        let monthCount = 12;
        let resListSize = resList.length;
        let xAxisData = new Array();      //x轴数据
        var incomeData = new Array();     //收入数据
        var expensesData = new Array();   //支出数据
        var netIncomeData = new Array();  //净收入数据
        for (let i = 0, y = 0; i < monthCount; i++) {
          let month = i + 1;
          xAxisData.push(month + "月");
          //该日期存有账单数据
          if (y < resListSize && parseInt(resList[y].noteMonth) === month) {
            incomeData.push(strip(resList[y].income));
            expensesData.push(strip(resList[y].expenses));
            netIncomeData.push(strip(resList[y].netIncome));
            y++;
          } else {
            incomeData.push(0);
            expensesData.push(0);
            netIncomeData.push(0);
          }
        }

        return _getChartData(xAxisData, incomeData, expensesData, netIncomeData);
      })
      .catch(err => {
        console.error(err);
        return {
          data: err,
          flag: 0
        };
      });
    return {
      code: 1,
      data: res,
      message: '查询账单图表数据成功',
    };

  }

  o.getAccountChartOfYear = async function () {
    const { _, db, $ } = await getDBConnection();
    const res = await db.collection('DANDAN_NOTE')
      .aggregate()
      .addFields({
        // formatDate: $.dateToString({
        //   date: '$noteDate',
        //   format: '%Y'
        // }),
        noteYear: $.dateToString({
          date: '$noteDate',
          format: '%Y'
        }),
        income: $.switch({
          branches: [
            { case: $.eq(['$flow', 1]), then: '$money' },
          ],
          default: 0
        }),
        expenses: $.switch({
          branches: [
            { case: $.eq(['$flow', 0]), then: $.multiply(['$money', -1]) },
          ],
          default: 0
        }),
      })
      .match({
        openId: wxContext.OPENID,
       // formatDate: o.date,
        isDel: false
      })
      .group({
        _id: '$noteYear',
        income: $.sum('$income'),
        expenses: $.sum('$expenses'),
      })
      .project({
        _id: 0,
        noteYear: '$_id',
        income: 1,
        expenses: 1,
        netIncome: $.add(['$income', '$expenses'])
      })
      .sort({
        noteYear: 1,
      })
      .limit(100)
      .end()
      .then(res => {
        let resList = res.list;
        let resListSize = resList.length;
        let xAxisData = new Array();      //x轴数据
        var incomeData = new Array();     //收入数据
        var expensesData = new Array();   //支出数据
        var netIncomeData = new Array();  //净收入数据
        for (let i = 0; i < resListSize; i++) {
          xAxisData.push(resList[i].noteYear + "年");
          //该日期存有账单数据
          incomeData.push(strip(resList[i].income));
          expensesData.push(strip(resList[i].expenses));
          netIncomeData.push(strip(resList[i].netIncome));
        }

        return _getChartData(xAxisData, incomeData, expensesData, netIncomeData);
      })
      .catch(err => {
        console.error(err);
        return {
          data: err,
          flag: 0
        };
      });
    return {
      code: 1,
      data: res,
      message: '查询账单图表数据成功',
    };

  }

  //获取图表数据
  async function _getChartData(xAxisArray, incomeArray, expenditureArray, netIncomeArray) {
    return {
      categories: xAxisArray,
      series: [{
        name: '收入',
        data: incomeArray
      }, {
        name: '支出',
        data: expenditureArray
      }, {
        name: '净收入',
        data: netIncomeArray
      }],
      operId: wxContext.OPENID
    }
  }


  function isNull(str) {
    if (str != "" && str != undefined && str != null) {
      return false;
    }
    return true;
  }

  function strip(num, precision = 12) {
    return +parseFloat(num.toPrecision(precision));
  }

  return o;
}
