// 全局用户数据，供 script.js 和 profile.js 共用
const users = [
  { name: 'Oliver Tao', username: 'taosir', password: '962777', vip: 'Pro会员', avatar: 'images/user00001.jpg', supreme: true, expire: '终身会员' },
  { name: '生物杨老师', username: 'user00002', password: '123456', vip: 'Pro会员', avatar: 'images/user00002.jpg', supreme: false, expire: '终身会员' },
  { name: '化学孙老师', username: 'user00003', password: '123456', vip: 'Pro会员', avatar: 'images/user00003.jpg', supreme: false, expire: '终身会员' },
  { name: '化学张老师', username: 'user00004', password: '123456', vip: 'Pro会员', avatar: 'images/user00004.jpg', supreme: false, expire: '2025-12-31' },
  { name: '邬学长', username: 'user00005', password: '123456', vip: '普通会员', avatar: 'images/user00005.jpg', supreme: false, expire: '2025-12-31' },
  { name: 'BenLi', username: 'user00006', password: '123456', vip: '普通会员', avatar: 'images/user00006.jpg', supreme: false, expire: '2025-12-30' },
  { name: 'Tuebo Social', username: 'user00007', password: 'abcdef', vip: '普通会员', avatar: 'images/user00007.jpg', supreme: false, expire: '2025-09-15' },
  { name: 'Miraitowa', username: 'user00008', password: '888888', vip: '普通会员', avatar: 'images/user00008.jpg', supreme: false, expire: '2027-01-01' },
  { name: '鱼游太玄', username: 'user00009', password: 'chaotianda', vip: '普通会员', avatar: 'images/user00009.jpg', supreme: false, expire: '2027-01-01' },
  { name: '翰林桥官方', username: 'user00010', password: 'sun123', vip: 'Pro会员', avatar: 'images/user00010.jpg', supreme: false, expire: '2025-12-31' },
  { name: '用户11', username: 'user00011', password: '123456', vip: '普通会员', avatar: 'images/user00011.png', supreme: false, expire: '2026-12-31' },
  { name: '用户12', username: 'user00012', password: '123456', vip: 'Pro会员', avatar: 'images/user00012.png', supreme: false, expire: '终身会员' },
  { name: 'Sam Leung', username: 'user00013', password: '25637568', vip: '普通会员', avatar: 'images/user00013.png', supreme: false, expire: '2025-06-30' },
  { name: '用户14', username: 'user00014', password: 'abcdef', vip: 'Pro会员', avatar: 'images/user00014.png', supreme: false, expire: '2027-01-01' },
  { name: '用户15', username: 'user00015', password: '888888', vip: '普通会员', avatar: 'images/user00015.png', supreme: false, expire: '2026-09-30' },
  { name: '用户16', username: 'user00016', password: '888888', vip: 'Pro会员', avatar: 'images/user00016.png', supreme: false, expire: '终身会员' },
  { name: '用户17', username: 'user00017', password: 'chaotianda', vip: '普通会员', avatar: 'images/user00017.png', supreme: false, expire: '2026-12-31' },
  { name: '用户18', username: 'user00018', password: 'sun123', vip: 'Pro会员', avatar: 'images/user00018.png', supreme: false, expire: '2027-03-31' },
  { name: '用户19', username: 'user00019', password: 'abcdef', vip: '普通会员', avatar: 'images/user00019.png', supreme: false, expire: '2026-03-31' },
  { name: '翰林桥团队', username: 'hanlinbridge', password: '172635', vip: 'Pro会员', avatar: 'images/user00020.png', supreme: false, expire: '终身会员' }
]; 