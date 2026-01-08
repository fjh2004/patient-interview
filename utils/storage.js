// 本地缓存管理工具类
// 功能：问卷数据本地存储、读取、清理

const STORAGE_KEYS = {
  QUESTIONNAIRE: 'diabetes_questionnaire',
  USER_INFO: 'user_basic_info'
};

class StorageManager {
  // 保存问卷数据到本地缓存
  static saveQuestionnaire(data) {
    try {
      // 将 answers 中的数组转换为 JSON 字符串，避免被 storage 转换
      const processedData = { ...data };
      if (processedData.answers) {
        for (const key in processedData.answers) {
          if (Array.isArray(processedData.answers[key])) {
            processedData.answers[key] = JSON.stringify(processedData.answers[key]);
          }
        }
      }
      wx.setStorageSync(STORAGE_KEYS.QUESTIONNAIRE, {
        ...processedData,
        lastUpdate: new Date().getTime()
      });
      return true;
    } catch (error) {
      console.error('保存问卷数据失败：', error);
      return false;
    }
  }

  // 读取本地缓存的问卷数据
  static getQuestionnaire() {
    try {
      const data = wx.getStorageSync(STORAGE_KEYS.QUESTIONNAIRE);
      if (data && data.lastUpdate) {
        // 检查数据是否过期（7天）
        const now = new Date().getTime();
        if (now - data.lastUpdate > 7 * 24 * 60 * 60 * 1000) {
          this.clearQuestionnaire();
          return null;
        }

        // 将 answers 中的 JSON 字符串转换回数组
        if (data.answers) {
          for (const key in data.answers) {
            const value = data.answers[key];
            if (typeof value === 'string' && value.startsWith('[')) {
              try {
                data.answers[key] = JSON.parse(value);
              } catch (e) {
                console.warn('解析答案数组失败:', key, value, e);
              }
            }
          }
        }

        return data;
      }
      return null;
    } catch (error) {
      console.error('读取问卷数据失败：', error);
      return null;
    }
  }

  // 清空问卷缓存
  static clearQuestionnaire() {
    try {
      wx.removeStorageSync(STORAGE_KEYS.QUESTIONNAIRE);
      return true;
    } catch (error) {
      console.error('清空问卷缓存失败：', error);
      return false;
    }
  }

  // 保存用户基本信息
  static saveUserInfo(userInfo) {
    try {
      wx.setStorageSync(STORAGE_KEYS.USER_INFO, {
        ...userInfo,
        lastUpdate: new Date().getTime()
      });
      return true;
    } catch (error) {
      console.error('保存用户信息失败：', error);
      return false;
    }
  }

  // 读取用户基本信息
  static getUserInfo() {
    try {
      return wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    } catch (error) {
      console.error('读取用户信息失败：', error);
      return null;
    }
  }

  // 检查是否有未完成的问卷
  static hasUnfinishedQuestionnaire() {
    const data = this.getQuestionnaire();
    return data && data.progress < data.totalQuestions;
  }

  // 获取当前进度
  static getCurrentProgress() {
    const data = this.getQuestionnaire();
    return data ? data.progress : 0;
  }

  // 更新单题答案
  static updateAnswer(questionId, answer) {
    const data = this.getQuestionnaire();
    if (data) {
      data.answers = data.answers || {};
      data.answers[questionId] = answer;
      data.progress = Math.max(data.progress, questionId + 1);
      return this.saveQuestionnaire(data);
    }
    return false;
  }

  // 批量更新答案
  static updateAnswers(answers) {
    const data = this.getQuestionnaire();
    if (data) {
      data.answers = { ...data.answers, ...answers };
      // 更新进度为最大题号
      const maxQuestionId = Math.max(...Object.keys(answers).map(Number));
      data.progress = Math.max(data.progress, maxQuestionId + 1);
      return this.saveQuestionnaire(data);
    }
    return false;
  }

  // 创建新的问卷记录
  static createNewQuestionnaire(userInfo, questionnaireTemplate) {
    const data = {
      id: this.generateUUID(),
      userInfo: userInfo,
      template: questionnaireTemplate,
      answers: {},
      progress: 0,
      totalQuestions: questionnaireTemplate.questions.length,
      startTime: new Date().getTime(),
      lastUpdate: new Date().getTime()
    };
    
    return this.saveQuestionnaire(data) ? data.id : null;
  }

  // 生成UUID
  static generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // 获取完整的问卷数据（用于提交）
  static getCompleteQuestionnaireData() {
    const data = this.getQuestionnaire();
    if (!data) return null;

    return {
      record_id: data.id,
      user_info: data.userInfo,
      questionnaire_template: data.template,
      answers: data.answers,
      progress: data.progress,
      total_questions: data.totalQuestions,
      start_time: data.startTime,
      submit_time: new Date().getTime()
    };
  }
}

module.exports = StorageManager;