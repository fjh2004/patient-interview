// 日志记录工具类 - 简化版，只记录必要指标
const StorageManager = require('./storage.js');

class Logger {
  constructor(page) {
    this.page = page;
    this.sessionId = this.generateSessionId();
    this.userId = this.getUserId();
    this.group = page.data.group;  // 'experimental' 或 'control'
    this.startTime = null;
    this.questionStartTimes = {};
    this.exitCount = 0;  // 新增：退出次数计数器
    this.lastExitTime = null;  // 新增：上次退出时间
  }

  // ==================== 基础功能 ====================

  // 生成会话ID
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 检查并清理过期会话（在页面加载时调用）
  static checkAndCleanExpiredSessions() {
    try {
      // 获取上次退出信息
      const lastExitInfo = StorageManager.getLastExitInfo();
      const currentSessionId = StorageManager.getCurrentSessionId();
      
      if (!lastExitInfo) {
        return; // 没有未完成的会话
      }

      const now = new Date().getTime();
      const exitTime = lastExitInfo.timestamp || lastExitInfo.exit_time;
      
      // 如果超过24小时未返回，认为是永久退出
      if (now - exitTime > 24 * 60 * 60 * 1000) {
        console.log('[会话清理] 检测到过期会话，清除本地记录');
        
        // 注意：这里无法更新云数据库，因为不知道会话ID
        // 但可以清除本地记录，让用户重新开始
        StorageManager.clearLastExitInfo();
        StorageManager.clearCurrentSessionId();
        StorageManager.clearQuestionnaire();
      }
    } catch (error) {
      console.error('[会话清理] 检查失败:', error);
    }
  }

  // 获取用户ID
  getUserId() {
    let userId = wx.getStorageSync('user_id');
    if (!userId) {
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      wx.setStorageSync('user_id', userId);
    }
    return userId;
  }

  // ==================== 维度1：应答率相关 ====================

  // 记录会话开始
  async logSessionStart() {
    this.startTime = Date.now();

    // 保存当前会话ID到本地存储
    StorageManager.saveCurrentSessionId(this.sessionId);

    const log = {
      logType: 'session_start',
      session_id: this.sessionId,
      user_id: this.userId,
      group: this.group,
      start_time: this.startTime
    };

    try {
      const result = await this.uploadLog('session_start', log);
      console.log('[日志] 会话开始:', log);
      return result;
    } catch (error) {
      // 即使云函数调用失败，也确保startTime和会话ID被设置
      console.error('[日志] 会话开始记录失败，但startTime和sessionId已设置:', error);
      return { success: false, message: error.message };
    }
  }

  // 记录会话结束
  async logSessionEnd(status, exitQuestionIndex = null, hasSkip = false, isExitEvent = false) {
    const endTime = Date.now();
    
    // 确保 startTime 有效，如果为 null 则使用当前时间
    const startTime = this.startTime || endTime;
    const duration = endTime - startTime; // 毫秒

    // 如果是退出事件，增加退出次数
    if (isExitEvent) {
      this.exitCount++;
      this.lastExitTime = endTime;
      console.log(`[日志] 退出事件，退出次数: ${this.exitCount}`);
    }

    const log = {
      logType: 'session_end',
      session_id: this.sessionId,
      user_id: this.userId,
      group: this.group,
      start_time: startTime,
      end_time: endTime,
      duration: duration,
      status: status,  // completed / abandoned
      exit_question_index: exitQuestionIndex,
      has_skip: hasSkip,
      exit_count: this.exitCount,  // 新增：退出次数
      last_exit_time: this.lastExitTime  // 新增：上次退出时间
    };

    const result = await this.uploadLog('session_end', log);
    console.log('[日志] 会话结束:', log);
    return result;
  }

  // 记录临时退出（用户可能返回）
  async logTemporaryExit(currentQuestionIndex, hasSkip = false) {
    const exitTime = Date.now();
    this.exitCount++;
    this.lastExitTime = exitTime;
    
    // 保存退出信息到本地，用户返回时可以恢复
    StorageManager.saveLastExitInfo({
      session_id: this.sessionId,
      exit_question_index: currentQuestionIndex,
      exit_time: exitTime,
      has_skip: hasSkip,
      answers: this.page.data.answers  // 保存当前答案
    });

    // 不清除当前会话ID，用户可能返回
    console.log(`[日志] 临时退出，退出次数: ${this.exitCount}，题号: ${currentQuestionIndex}`);

    // 不立即上传到云数据库，等待用户返回或永久退出
    return { success: true, isTemporary: true };
  }

  // 记录永久退出（用户不再返回）
  async logPermanentExit(currentQuestionIndex, hasSkip = false) {
    const endTime = Date.now();
    
    // 清除本地退出信息
    StorageManager.clearLastExitInfo();
    StorageManager.clearCurrentSessionId();

    // 记录为abandoned
    return this.logSessionEnd('abandoned', currentQuestionIndex, hasSkip, true);
  }

  // 用户返回，恢复会话
  async logSessionResume() {
    const lastExit = StorageManager.getLastExitInfo();
    if (lastExit && lastExit.session_id === this.sessionId) {
      // 清除退出标记
      StorageManager.clearLastExitInfo();
      
      console.log(`[日志] 会话恢复，上次退出题号: ${lastExit.exit_question_index}`);
      return { success: true, lastExitInfo: lastExit };
    }
    return { success: false, message: '无退出记录或会话不匹配' };
  }

  // ==================== 维度2：准确性相关 ====================

  // logAnswer 方法已废弃，答案直接保存在 fill_record 中
  async logAnswer(question, answer) {
    // 不再记录 answer_details，答案在 fill_record.answers 中
    return { success: true };
  }

  // ==================== 维度3：LLM交互相关（仅实验组）====================

  // 记录LLM交互（简化版）
  async logLLMInteraction(eventType, userAction) {
    if (this.group !== 'experimental') return null;

    const log = {
      logType: 'llm_interaction',
      session_id: this.sessionId,
      event_type: eventType,  // logic_check / ai_question
      user_action: userAction  // accept / reject / ignore
    };

    const result = await this.uploadLog('llm_interaction', log);
    console.log('[日志] LLM交互:', log);
    return result;
  }

  // ==================== 辅助函数 ====================

  // 上传日志到云函数
  async uploadLog(logType, logData) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'submitLog',
        data: {
          logType: logType,
          ...logData
        }
      });

      if (res.result && res.result.success) {
        return res.result;
      } else {
        console.error('[日志] 上传失败:', res.result);
        this.cacheLog(logData);
        return { success: false, message: res.result?.message };
      }
    } catch (err) {
      console.error('[日志] 上传异常:', err);
      this.cacheLog(logData);
      return { success: false, message: err.message };
    }
  }

  // 缓存日志到本地
  cacheLog(logData) {
    let cachedLogs = wx.getStorageSync('cached_logs') || [];
    cachedLogs.push({
      ...logData,
      cached_at: Date.now()
    });
    wx.setStorageSync('cached_logs', cachedLogs);

    // 限制缓存大小
    if (cachedLogs.length > 100) {
      cachedLogs = cachedLogs.slice(-100);
      wx.setStorageSync('cached_logs', cachedLogs);
    }
  }

  // 记录题目开始时间（用于计算单题时长）
  recordQuestionStartTime(questionId) {
    this.questionStartTimes[questionId] = Date.now();
  }

  // 获取题目时长
  getQuestionDuration(questionId) {
    const startTime = this.questionStartTimes[questionId];
    if (!startTime) return 0;
    return (Date.now() - startTime) / 1000; // 秒
  }

  // 获取会话ID
  getSessionId() {
    return this.sessionId;
  }

  // 获取用户ID
  getUserId() {
    return this.userId;
  }

  // 获取分组
  getGroup() {
    return this.group;
  }
}

module.exports = Logger;
