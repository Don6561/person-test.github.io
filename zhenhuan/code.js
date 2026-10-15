/* ============================================================
 * 访问口令  ——  全场只用这一个固定码
 *
 * 改这里就行。字母数字都可以，长度随意（1-12 位），
 * 输入框长度和错误提示会自动跟着变，不用改别的地方。
 *
 * 注意：这是「口令」不是「密码」，页面源码里能看到，挡不住有心人。
 * 它的作用是拦住顺手转发，不是防破解——别在上面浪费时间。
 * ============================================================ */

const FIXED_CODE = '1008';

/* ===== 以下一般不用动 ===== */

function normCode(s){
  return String(s == null ? '' : s).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function verifyCode(raw){
  const c = normCode(raw);
  const want = normCode(FIXED_CODE);
  return c.length > 0 && want.length > 0 && c === want;
}

/* 链接直连时读取当前口令（用于拼接 ?c= ） */
function currentCode(){
  return normCode(FIXED_CODE);
}
