// 初始化云函数 - 返回问卷模板和配置信息
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 预制问卷数据（32道题完整配置）
const QUESTIONNAIRE_TEMPLATE = {
  "title": "糖尿病体检前健康问卷",
  "questions": [
    {"id":1,"content":"姓名","type":"input_single","placeholder":"请输入您的姓名","required":true,"rule":""},
    {"id":2,"content":"手机号","type":"input_single","placeholder":"无则不填","required":false,"rule":""},
    {"id":3,"content":"年龄","type":"input_number","placeholder":"请输入实际年龄，如：56","required":true,"rule":""},
    {"id":4,"content":"性别","type":"radio","options":["A. 男性","B. 女性"],"required":true,"rule":"关联32/33题，仅女性显示"},
    {"id":5,"content":"您的受教育程度","type":"radio","options":["A. 未受过教育","B. 小学","C. 初中","D. 高中","E. 大学及以上"],"required":true,"rule":"适配语言表述（低学历用通俗语）"},
    {"id":6,"content":"您的父母或兄弟姐妹是否患有以下明确诊断的疾病？","type":"checkbox","options":["A. 高血压","B. 脑卒中","C. 冠心病","D. 外周血管病","E. 糖尿病","F. 肥胖症","G. 慢性肾脏疾病","H. 慢性阻塞性肺病","I. 骨质疏松","J. 肺癌","K. 肝癌","L. 胃癌","M. 食管癌","N. 结直肠癌","O. 乳腺癌","P. 胰腺癌","Q. 宫颈癌","R. 前列腺癌","S. 甲状腺癌","T. 其他疾病","U. 以上皆无"],"required":true,"rule":"与7题逻辑关联（家族史-自身患病一致性）"},
    {"id":7,"content":"您的父亲是否在 55 岁之前或母亲在 65 岁之前患有冠心病？","type":"radio","options":["A. 是","B. 否"],"required":true,"rule":""},
    {"id":8,"content":"您是否患有以下明确诊断的疾病？","type":"checkbox","options":["A. 高血压","B. 脑卒中","C. 冠心病","D. 外周血管病","E. 糖尿病","F. 肥胖症","G. 慢性肾脏疾病","H. 慢性阻塞性肺病","I. 骨质疏松","J. 肺癌","K. 肝癌","L. 胃癌","M. 食管癌","N. 结直肠癌","O. 乳腺癌","P. 胰腺癌","Q. 宫颈癌","R. 前列腺癌","S. 甲状腺癌","T. 其他疾病","U. 以上皆无"],"required":true,"rule":"与5/8题逻辑关联"},
    {"id":9,"content":"您是否长期服用药物或营养素？(连续服用 6 个月以上，平均每日服用一次以上)","type":"checkbox","options":["A. 降压药","B. 降糖药","C. 降脂药","D. 降尿酸药","E. 抗心律失常药","F. 其他","G. 以上皆无"],"required":true,"rule":"与7题逻辑关联（患病-用药一致性）"},
    {"id":10,"content":"您对什么物质过敏？","type":"checkbox","options":["A. 青霉素","B. 磺胺类","C. 链霉素","D. 头孢类","E. 其他","F. 以上皆无"],"required":true,"rule":""},
    {"id":11,"content":"您是否因疾病进行过手术治疗？","type":"checkbox","options":["A. 头颅 (含脑)","B. 胸部 (含肺部)","C. 心脏 (含心脏介入)","D. 胃肠","E. 肝胆","F. 肾脏","G. 其它部位","H. 以上皆无"],"required":true,"rule":""},
    {"id":12,"content":"您是否吸烟？","type":"radio","options":["A. 没有","B. 吸烟","C. 已戒烟 1 年以上","D. 被动吸烟 (每周累计 1 天以上)"],"required":true,"rule":""},
    {"id":13,"content":"您是否饮酒？","type":"radio","options":["A. 不喝","B. 偶尔喝","C. 已戒酒 1 年以上","D. 经常喝 (每周大于 2 次)"],"required":true,"rule":""},
    {"id":14,"content":"您每周运动的天数","type":"radio","options":["A. 不到 1 天","B.3 天以内","C.3 天以上"],"required":true,"rule":""},
    {"id":15,"content":"您的主食结构如何","type":"radio","options":["A. 细粮为主","B. 粗细搭配","C. 粗粮为主","D. 不好说"],"required":true,"rule":""},
    {"id":16,"content":"您通常能够按时吃三餐吗？","type":"radio","options":["A. 能","B. 基本能 (每周有 2-3 次不能按时就餐)","C. 不能 (每周超过 3 次不能按时就餐)"],"required":true,"rule":""},
    {"id":17,"content":"您的进餐速度","type":"radio","options":["A. 用餐时间小于 10 分钟","B. 用餐时间大于 10 分钟"],"required":true,"rule":""},
    {"id":18,"content":"您的饮食偏好","type":"checkbox","options":["A. 熏制、腌制类","B. 油炸食品","C. 甜点","D. 吃零食 (适量坚果除外)","E. 吃快餐","F. 喝粥","G. 其他"],"required":true,"rule":""},
    {"id":19,"content":"您的饮食口味？","type":"checkbox","options":["A. 清淡","B. 咸","C. 甜","D. 高油脂","E. 辛辣","F. 热烫"],"required":true,"rule":""},
    {"id":20,"content":"您每晚的睡眠时间？(不等于卧床时间)","type":"radio","options":["A.<5 小时","B.5-7 小时","C.7-9 小时","D.>9 小时"],"required":true,"rule":""},
    {"id":21,"content":"过去的两周内感觉紧张、焦虑或烦躁的频率为？","type":"radio","options":["A. 没有","B. 数天","C. 超过一半天数","D. 几乎每天"],"required":true,"rule":"用于情绪干预（烦躁时简化选项）"},
    {"id":22,"content":"最近三个月，您有咳嗽、咳痰吗？","type":"radio","options":["A. 没有","B. 偶尔 (每周 1~2 次)","C. 经常 (每周 3 次以上)"],"required":true,"rule":""},
    {"id":23,"content":"最近三个月，您有鼻出血或浓血鼻涕吗？","type":"radio","options":["A. 没有","B. 偶尔 (每周 1~2 次)","C. 经常 (每周 3 次以上)"],"required":true,"rule":""},
    {"id":24,"content":"最近三个月，您出现过吞咽不适、哽噎感吗？","type":"radio","options":["A. 没有","B. 偶尔 (每周 1~2 次)","C. 经常 (每周 3 次以上)"],"required":true,"rule":""},
    {"id":25,"content":"最近三个月，您感到胸痛或心前区憋闷不适吗？","type":"radio","options":["A. 没有","B. 偶尔 (每周 1~2 次)","C. 经常 (每周 3 次以上)"],"required":true,"rule":""},
    {"id":26,"content":"最近三个月，您感到有胸闷气喘或呼吸困难吗？","type":"radio","options":["A. 没有","B. 偶尔 (每周 1~2 次)","C. 经常 (每周 3 次以上)"],"required":true,"rule":""},
    {"id":27,"content":"最近三个月，您感到恶心、反酸或上腹部不适吗？","type":"radio","options":["A. 没有","B. 偶尔 (每周 1~2 次)","C. 经常 (每周 3 次以上)"],"required":true,"rule":""},
    {"id":28,"content":"最近三个月，您有过不明原因跌倒或晕倒吗？","type":"radio","options":["A. 没有","B. 偶尔 (每周 1~2 次)","C. 经常 (每周 3 次以上)"],"required":true,"rule":""},
    {"id":29,"content":"最近三个月，您出现过柏油样便或便中带血吗？","type":"radio","options":["A. 没有","B. 偶尔 (每周 1~2 次)","C. 经常 (每周 3 次以上)"],"required":true,"rule":""},
    {"id":30,"content":"最近三个月，您出现过不明原因的身体消瘦或体重减轻吗？(体重减轻超过原来体重的 10%)","type":"radio","options":["A. 没有","B. 有"],"required":true,"rule":""},
    {"id":31,"content":"您最关注的健康问题是什么？","type":"input_multi","placeholder":"如：血糖控制、视力模糊等","required":false,"rule":""},
    {"id":32,"content":"(限女性填写) 最近 3 个月，您有不明原因的阴道出血、白带异常吗？","type":"radio","options":["A. 没有","B. 有"],"required":true,"rule":"仅性别选'女性'时显示"},
    {"id":33,"content":"(限女性填写) 您是否已经绝经？","type":"radio","options":["A. 否","B. 是"],"required":true,"rule":"仅性别选'女性'时显示"}
  ]
};

// 医学术语库
const TERM_LIBRARY = {
  "糖尿病": "血糖长期过高的一种慢性病，需要控制饮食和用药管理",
  "高血压": "血压持续偏高的状况，会增加心脑血管疾病风险",
  "冠心病": "心脏血管狭窄或堵塞导致的心脏病",
  "脑卒中": "俗称中风，脑部血管突然破裂或堵塞",
  "肥胖症": "体重明显超标，会增加多种疾病风险",
  "慢性肾脏疾病": "肾脏功能逐渐减退的长期疾病",
  "慢性阻塞性肺病": "肺部气流受限的慢性炎症，常见于吸烟者",
  "骨质疏松": "骨骼变脆易骨折的状况",
  "降压药": "用于控制血压的药物",
  "降糖药": "用于降低血糖的药物，如胰岛素等",
  "降脂药": "用于降低血液中脂肪含量的药物",
  "降尿酸药": "用于控制尿酸水平的药物",
  "抗心律失常药": "用于调节心跳规律的药物",
  "咳嗽": "呼吸道受刺激产生的反射动作",
  "咳痰": "咳嗽时排出呼吸道分泌物",
  "鼻出血": "鼻腔血管破裂导致的出血",
  "吞咽不适": "吃东西时感觉卡住或疼痛",
  "胸痛": "胸部区域的疼痛感",
  "呼吸困难": "感觉呼吸费力或气不够用",
  "恶心": "想呕吐的不适感",
  "反酸": "胃酸反流到食管的感觉",
  "消瘦": "体重不明原因明显下降",
  "手机号": "用户联系电话号码",
  "血糖控制": "通过饮食、运动和药物维持血糖在正常范围",
  "视力模糊": "看东西不清楚，可能是糖尿病并发症"
};

// 云开发配置说明
const CONFIG_TIPS = {
  "env_id": "请在微信开发者工具中替换为您的云环境ID",
  "llm_api": "如需使用智谱AI，请配置API密钥",
  "database": "云数据库会自动初始化，无需手动操作",
  "dependencies": "云函数依赖已配置，上传时自动安装"
};

/**
 * 主函数 - 初始化问卷系统
 */
async function main(event, context) {
  try {
    // 检查问卷表是否存在，不存在则创建
    await initQuestionnaireTable();
    
    // 返回初始化数据
    return {
      success: true,
      data: {
        questionnaire: QUESTIONNAIRE_TEMPLATE,
        termLibrary: TERM_LIBRARY,
        configTips: CONFIG_TIPS,
        initTime: new Date().toISOString()
      },
      message: '初始化成功'
    };
    
  } catch (error) {
    console.error('初始化失败：', error);
    
    // 降级处理：返回本地模板数据
    return {
      success: false,
      data: {
        questionnaire: QUESTIONNAIRE_TEMPLATE,
        termLibrary: TERM_LIBRARY,
        configTips: CONFIG_TIPS,
        fallback: true,
        error: error.message
      },
      message: '数据库初始化失败，使用本地模板'
    };
  }
}

/**
 * 初始化问卷表
 */
async function initQuestionnaireTable() {
  try {
    // 检查问卷表是否存在
    const collectionList = await db.listCollections();
    const questionnaireExists = collectionList.collections.some(
      col => col.name === 'questionnaire'
    );
    
    if (!questionnaireExists) {
      // 创建问卷表并插入默认数据
      await db.createCollection('questionnaire');
      
      const result = await db.collection('questionnaire').add({
        data: {
          ...QUESTIONNAIRE_TEMPLATE,
          create_time: db.serverDate(),
          update_time: db.serverDate(),
          version: '1.0.0',
          status: 'active'
        }
      });
      
      console.log('问卷表创建成功，ID：', result._id);
    } else {
      console.log('问卷表已存在');
    }
    
    return true;
    
  } catch (error) {
    console.error('初始化问卷表失败：', error);
    throw error;
  }
}

/**
 * 初始化其他相关表
 */
async function initOtherTables() {
  try {
    const tables = ['fill_record', 'llm_log'];
    
    for (const tableName of tables) {
      const collectionList = await db.listCollections();
      const tableExists = collectionList.collections.some(
        col => col.name === tableName
      );
      
      if (!tableExists) {
        await db.createCollection(tableName);
        console.log(`表 ${tableName} 创建成功`);
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('初始化其他表失败：', error);
    // 不影响主流程，记录日志即可
    return false;
  }
}

// 导出主函数
exports.main = main;