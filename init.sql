-- Schema only: business data and user records have been excluded.

SET NAMES utf8mb4;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `iot_alarm`;
CREATE TABLE `iot_alarm` (
  `alarm_id` bigint NOT NULL AUTO_INCREMENT,
  `device_id` varchar(64) DEFAULT NULL COMMENT '关联设备ID(系统告警可为NULL)',
  `alarm_type` varchar(50) NOT NULL,
  `severity` tinyint DEFAULT '1',
  `content` varchar(255) DEFAULT NULL,
  `status` tinyint DEFAULT '0',
  `related_id` varchar(64) DEFAULT NULL COMMENT '关联业务ID(如rfid或material_code)',
  `alarm_source` varchar(20) DEFAULT 'device' COMMENT 'device/stock/system',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `resolve_time` datetime DEFAULT NULL,
  `resolve_remark` varchar(255) DEFAULT NULL,
  `resolve_user` varchar(50) DEFAULT NULL COMMENT '处理人',
  PRIMARY KEY (`alarm_id`),
  KEY `idx_source` (`alarm_source`,`related_id`)
) ENGINE=InnoDB AUTO_INCREMENT=120 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系统告警记录表';

DROP TABLE IF EXISTS `iot_device`;
CREATE TABLE `iot_device` (
  `device_id` varchar(64) NOT NULL COMMENT '设备唯一标识',
  `device_name` varchar(100) NOT NULL COMMENT '设备名称',
  `device_type` varchar(50) DEFAULT 'sensor' COMMENT '类型: sensor, gateway, rfid_reader',
  `location` varchar(200) DEFAULT '' COMMENT '部署位置',
  `status` tinyint DEFAULT '0' COMMENT '在线状态',
  `owner_id` bigint DEFAULT NULL COMMENT '关联用户ID',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='物联网设备表';

DROP TABLE IF EXISTS `iot_device_config`;
CREATE TABLE `iot_device_config` (
  `config_id` bigint NOT NULL AUTO_INCREMENT,
  `device_id` varchar(64) NOT NULL,
  `temp_max` decimal(5,2) DEFAULT '30.00',
  `temp_min` decimal(5,2) DEFAULT '0.00',
  `humidity_max` decimal(5,2) DEFAULT '70.00',
  `humidity_min` decimal(10,2) DEFAULT '20.00' COMMENT '湿度下限阈值',
  `smoke_threshold` decimal(10,2) DEFAULT '2000.00',
  `pressure_max` decimal(10,2) DEFAULT '1050.00',
  `dew_point_max` decimal(10,2) DEFAULT '25.00',
  `lux_max` decimal(10,2) DEFAULT '10000.00' COMMENT '光照上限阈值(Lux)',
  `work_mode` varchar(20) DEFAULT 'both' COMMENT '工作模式: inbound(入库), outbound(出库), both(双向)',
  `alarm_mode` varchar(20) DEFAULT 'auto' COMMENT '报警模式: auto(自动), manual(手动)',
  PRIMARY KEY (`config_id`),
  UNIQUE KEY `uk_device` (`device_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='设备阈值配置表';

DROP TABLE IF EXISTS `iot_device_user`;
CREATE TABLE `iot_device_user` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `device_id` varchar(64) NOT NULL,
  `user_id` bigint NOT NULL,
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_device_user` (`device_id`,`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `iot_sensor_data`;
CREATE TABLE `iot_sensor_data` (
  `data_id` bigint NOT NULL AUTO_INCREMENT,
  `device_id` varchar(64) NOT NULL,
  `temperature` decimal(5,2) DEFAULT NULL,
  `humidity` decimal(5,2) DEFAULT NULL,
  `pressure` decimal(8,2) DEFAULT NULL,
  `smoke_density` decimal(10,2) DEFAULT NULL,
  `extra_info` json DEFAULT NULL COMMENT '扩展数据',
  `report_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `dew_point` decimal(10,2) DEFAULT NULL COMMENT '露点',
  `luminance` decimal(10,2) DEFAULT NULL COMMENT '光照强度(Lux)',
  PRIMARY KEY (`data_id`),
  KEY `idx_device_time` (`device_id`,`report_time`)
) ENGINE=InnoDB AUTO_INCREMENT=19327 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='传感器历史数据表';

DROP TABLE IF EXISTS `iot_switch_log`;
CREATE TABLE `iot_switch_log` (
  `log_id` bigint NOT NULL AUTO_INCREMENT,
  `device_id` varchar(64) NOT NULL,
  `component_name` varchar(50) NOT NULL,
  `action` varchar(20) NOT NULL,
  `status` tinyint DEFAULT NULL,
  `trigger_source` varchar(20) DEFAULT 'manual',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `user_id` bigint DEFAULT NULL COMMENT 'Operating User ID',
  PRIMARY KEY (`log_id`),
  KEY `idx_device_comp` (`device_id`,`component_name`)
) ENGINE=InnoDB AUTO_INCREMENT=943 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='开关控制日志表';

DROP TABLE IF EXISTS `sys_user`;
CREATE TABLE `sys_user` (
  `user_id` bigint NOT NULL AUTO_INCREMENT COMMENT '用户主键ID',
  `username` varchar(50) NOT NULL COMMENT '用户名',
  `password` varchar(100) NOT NULL COMMENT '密码（加密存储）',
  `nickname` varchar(50) DEFAULT '用户' COMMENT '昵称',
  `status` tinyint DEFAULT '1' COMMENT '帐号状态（1正常 0停用）',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `role` varchar(20) DEFAULT 'user',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户信息表';

DROP TABLE IF EXISTS `wms_category`;
CREATE TABLE `wms_category` (
  `category_id` bigint NOT NULL AUTO_INCREMENT,
  `category_name` varchar(50) NOT NULL,
  `description` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`category_id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='物资分类表';

DROP TABLE IF EXISTS `wms_io_record`;
CREATE TABLE `wms_io_record` (
  `record_id` bigint NOT NULL AUTO_INCREMENT,
  `rfid_tag` varchar(64) NOT NULL,
  `io_type` tinyint NOT NULL COMMENT '1:入库 2:出库 3:盘点',
  `order_no` varchar(64) DEFAULT NULL COMMENT '关联单据号/任务号',
  `device_id` varchar(64) DEFAULT NULL COMMENT '扫描设备ID',
  `time` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`record_id`),
  KEY `idx_time` (`time`)
) ENGINE=InnoDB AUTO_INCREMENT=409 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='物资流转记录表';

DROP TABLE IF EXISTS `wms_location`;
CREATE TABLE `wms_location` (
  `id` varchar(50) NOT NULL COMMENT '库位ID',
  `name` varchar(100) NOT NULL COMMENT '库位名称',
  `parent_id` varchar(50) DEFAULT NULL COMMENT '父级ID',
  `level` tinyint DEFAULT '1' COMMENT '层级',
  `sort_order` int DEFAULT '0' COMMENT '排序',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='仓库库位表';

DROP TABLE IF EXISTS `wms_material`;
CREATE TABLE `wms_material` (
  `material_id` bigint NOT NULL AUTO_INCREMENT,
  `material_code` varchar(50) NOT NULL COMMENT '物资编码',
  `name` varchar(100) NOT NULL COMMENT '物资名称',
  `category_id` bigint DEFAULT NULL COMMENT '分类ID',
  `unit` varchar(20) DEFAULT '个' COMMENT '单位',
  `spec` varchar(100) DEFAULT NULL COMMENT '规格型号',
  `expiry_warning_days` int DEFAULT '30' COMMENT '有效期预警天数',
  `min_stock` int DEFAULT '0' COMMENT '最低库存预警',
  `max_stock` int DEFAULT '99999' COMMENT '最大库存限制',
  `image_url` varchar(255) DEFAULT '' COMMENT '物资图片路径',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`material_id`),
  UNIQUE KEY `material_code` (`material_code`)
) ENGINE=InnoDB AUTO_INCREMENT=68 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='物资基础档案表';

DROP TABLE IF EXISTS `wms_stock_item`;
CREATE TABLE `wms_stock_item` (
  `item_id` bigint NOT NULL AUTO_INCREMENT,
  `rfid_tag` varchar(64) NOT NULL COMMENT 'RFID标签UID',
  `material_id` bigint NOT NULL COMMENT '关联物资ID',
  `quantity` decimal(10,2) DEFAULT '1.00' COMMENT '数量',
  `batch_no` varchar(50) DEFAULT NULL COMMENT '生产批次',
  `expiry_date` date DEFAULT NULL COMMENT '有效期至',
  `location` varchar(100) DEFAULT NULL COMMENT '库位',
  `status` tinyint DEFAULT '1' COMMENT '1:在库 2:出库 3:损耗 4:过期',
  `in_time` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`item_id`),
  UNIQUE KEY `rfid_tag` (`rfid_tag`),
  KEY `idx_expiry` (`expiry_date`),
  KEY `idx_rfid` (`rfid_tag`)
) ENGINE=InnoDB AUTO_INCREMENT=282 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='库存实物明细表';

SET FOREIGN_KEY_CHECKS = 1;

