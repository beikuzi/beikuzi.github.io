"""
Python脚本打包器 - PyInstaller图形化界面工具

功能：
    - 图形化界面操作PyInstaller打包Python脚本
    - 支持单个或批量打包多个Python脚本
    - 自动检测系统中安装的Python解释器（包括虚拟环境）
    - 优先使用当前执行脚本的Python解释器
    - 支持拖放添加脚本文件
    - 自动检测和安装PyInstaller
    - 可配置打包选项（单文件/多文件、控制台/无控制台、图标等）
    - 实时显示打包日志

使用方法：
    python myscript/packager.py

配置说明：
    - 配置文件: .config/mypackager.json（自动创建）
    - 默认输出目录: dist（可执行文件）
    - 默认构建目录: .misc/.build/build（临时文件）
    - 默认spec目录: .misc/.build/spec（spec文件）
    - 所有路径都相对于项目根目录

注意事项：
    - 建议使用目标脚本对应的Python解释器进行打包，避免依赖缺失
    - 打包前确保目标解释器已安装PyInstaller
    - 虚拟环境解释器会优先显示在列表顶部
    - 当前执行脚本的解释器会自动设为默认选项
"""

import sys
import os
import subprocess
from PyQt5.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QLineEdit, QPushButton, QFileDialog, 
                             QLabel, QMessageBox, QListWidget, QListWidgetItem,
                             QFrame, QDialog, QScrollArea, QComboBox, QCheckBox,
                             QGroupBox, QFormLayout, QTextEdit, QTabWidget,
                             QRadioButton, QButtonGroup)
from PyQt5.QtCore import Qt, QMimeData, QProcess
from PyQt5.QtGui import QDragEnterEvent, QDropEvent

# ==================== 配置常量 ====================

# 配置文件路径
CONFIG_FILE = '.config/mypackager.json'

# 默认配置
DEFAULT_CONFIG = {
    # 构建目录配置（所有路径都相对于项目根目录）
    "build_output_dir": "dist",    # 输出目录（可执行文件存放位置）
    "build_temp_dir": ".misc/.build/build",     # 构建临时目录（PyInstaller临时文件）
    "build_spec_dir": ".misc/.build/spec",      # spec文件目录（PyInstaller spec文件）
    
    # 打包默认选项
    "default_onefile": True,                # 默认生成单文件
    "default_console": True,                # 默认显示控制台
    "default_clean": True,                  # 默认打包前清理
    
    # 打包额外参数
    "extra_data": "",                       # 额外数据参数（--add-data）
    "extra_binary": "",                     # 二进制文件参数（--add-binary）
    "extra_args": "",                       # 其他PyInstaller参数
    "auto_analyze_deps": False,             # 是否自动分析二进制依赖
    
    # 虚拟环境搜索配置
    "venv_search_dirs": [
        ".misc/.venv",                      # 新的统一管理目录
        ".misc/venv",
        ".venv",                            # 常规虚拟环境
        "venv",
        "env",
        ".env",
        "virtualenv",
        ".virtualenv",
        "pyenv",
        ".pyenv"
    ],
    
    # Python解释器搜索路径（Windows）
    "python_search_paths": [
        r"C:\Python*\python.exe",
        r"C:\Program Files\Python*\python.exe",
        r"C:\Program Files (x86)\Python*\python.exe",
        r"C:\Users\*\Anaconda*\python.exe",
        r"C:\ProgramData\Anaconda*\python.exe",
        r"C:\Users\*\AppData\Local\Programs\Python\Python*\python.exe"
    ],
    
    # 父目录搜索深度（向上查找虚拟环境的层级数）
    "parent_dir_search_depth": 0
}

# ==================== 配置常量结束 ====================


def ensure_config_file(config_path=None):
    """确保配置文件存在,不存在则创建"""
    if config_path is None:
        config_path = CONFIG_FILE
    
    config_dir = os.path.dirname(config_path)
    if config_dir:
        os.makedirs(config_dir, exist_ok=True)
    
    if not os.path.exists(config_path):
        with open(config_path, 'w', encoding='utf-8') as f:
            import json
            json.dump(DEFAULT_CONFIG, f, ensure_ascii=False, indent=4)
        return True, f'已创建配置文件: {config_path}'
    return False, '配置文件已存在'


def load_config(config_path=None):
    """读取配置文件,确保所有必需参数存在"""
    if config_path is None:
        config_path = CONFIG_FILE
    
    # 确保配置文件存在
    ensure_config_file(config_path)
    
    import json
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    # 检查并补充缺失的参数
    updated = False
    for key, default_value in DEFAULT_CONFIG.items():
        if key not in config:
            config[key] = default_value
            updated = True
    
    # 如果有更新,写回配置文件
    if updated:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=4)
    
    return config



class DragDropLineEdit(QLineEdit):
    """
    支持拖放的文本框
    """
    def __init__(self, parent=None, accept_dirs=False, accept_files=False, file_extensions=None):
        super().__init__(parent)
        self.setAcceptDrops(True)
        self.accept_dirs = accept_dirs  # 是否接受目录拖放
        self.accept_files = accept_files  # 是否接受文件拖放
        self.file_extensions = file_extensions or []  # 接受的文件扩展名列表
        
    def dragEnterEvent(self, event: QDragEnterEvent):
        """当拖动进入控件时触发"""
        if event.mimeData().hasUrls():
            urls = event.mimeData().urls()
            if urls:
                path = urls[0].toLocalFile()
                # 根据设置接受目录或文件
                if (self.accept_dirs and os.path.isdir(path)) or \
                   (self.accept_files and os.path.isfile(path) and 
                    (not self.file_extensions or any(path.lower().endswith(ext) for ext in self.file_extensions))):
                    event.acceptProposedAction()
                    return
        event.ignore()
    
    def dropEvent(self, event: QDropEvent):
        """当放置文件时触发"""
        added_files = False
        
        # 处理URL类型的拖放（从文件资源管理器）
        if event.mimeData().hasUrls():
            urls = event.mimeData().urls()
            for url in urls:
                file_path = url.toLocalFile()
                if file_path.lower().endswith('.py'):
                    self.packager.add_script_to_list(file_path)
                    added_files = True
        
        # 处理文本类型的拖放（可能是从IDE）
        elif event.mimeData().hasText():
            text = event.mimeData().text().strip()
            
            # 尝试多种可能的路径格式
            potential_paths = [text]
            
            # 如果文本包含路径分隔符和.py，可能是Python文件路径
            if ('/' in text or '\\' in text) and '.py' in text.lower():
                # 尝试提取可能的Python文件路径
                import re
                py_paths = re.findall(r'[a-zA-Z]:[/\\][^"\'<>|:*?\r\n]*\.py', text, re.IGNORECASE)
                py_paths.extend(re.findall(r'(?:/[^/\r\n]+)+\.py', text, re.IGNORECASE))
                potential_paths.extend(py_paths)
                
                # 如果文本以file:///开头，可能是URI格式
                if text.startswith('file:///'):
                    potential_paths.append(text[8:].replace('/', os.path.sep))
            
            # 尝试所有可能的路径
            for path in potential_paths:
                if os.path.exists(path) and path.lower().endswith('.py'):
                    self.packager.add_script_to_list(path)
                    added_files = True
                    break
        
        # 检查所有MIME类型，尝试找到可能的文件路径
        for mime_format in event.mimeData().formats():
            if not added_files and 'text' in mime_format.lower():
                try:
                    data = event.mimeData().data(mime_format).data().decode('utf-8', errors='replace')
                    
                    # 查找可能的Python文件路径
                    if '.py' in data.lower():
                        import re
                        py_paths = re.findall(r'[a-zA-Z]:[/\\][^"\'<>|:*?\r\n]*\.py', data, re.IGNORECASE)
                        py_paths.extend(re.findall(r'(?:/[^/\r\n]+)+\.py', data, re.IGNORECASE))
                        
                        for py_path in py_paths:
                            if os.path.exists(py_path):
                                self.packager.add_script_to_list(py_path)
                                added_files = True
                                break
                except:
                    pass
        
        if added_files:
            event.acceptProposedAction()
        else:
            event.acceptProposedAction()  # 即使没有添加文件也接受事件，避免禁止符号
            # 如果没有添加任何文件，显示提示
            QMessageBox.information(self.packager, "提示", "无法识别拖放的Python文件。请确保拖放的是.py文件。")


class ScriptItemWidget(QWidget):
    """
    脚本项组件，包含脚本路径和操作按钮
    """
    def __init__(self, script_path, parent=None):
        super().__init__(parent)
        self.script_path = script_path
        self.packager = parent
        
        layout = QHBoxLayout(self)
        layout.setContentsMargins(5, 2, 5, 2)
        
        self.label = QLabel(os.path.basename(script_path))
        self.label.setToolTip(script_path)
        layout.addWidget(self.label, 1)
        
        self.edit_btn = QPushButton("编辑")
        self.edit_btn.setMaximumWidth(60)
        self.edit_btn.clicked.connect(self.edit_script)
        layout.addWidget(self.edit_btn)
        
        self.delete_btn = QPushButton("删除")
        self.delete_btn.setMaximumWidth(60)
        self.delete_btn.clicked.connect(self.delete_script)
        layout.addWidget(self.delete_btn)
        
        self.setLayout(layout)
    
    def edit_script(self):
        """编辑脚本路径"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择Python脚本", "", "Python Files (*.py)"
        )
        if file_path:
            self.script_path = file_path
            self.label.setText(os.path.basename(file_path))
            self.label.setToolTip(file_path)
            if self.packager:
                self.packager.update_script_list()
    
    def delete_script(self):
        """删除此脚本项"""
        if self.packager:
            self.packager.remove_script(self)


class BinaryItemWidget(QWidget):
    """
    二进制文件项组件，包含文件/目录路径、目标路径和操作按钮
    """
    def __init__(self, source_path, dest_path=".", parent=None):
        super().__init__(parent)
        self.source_path = source_path
        self.dest_path = dest_path
        self.packager = parent
        
        layout = QHBoxLayout(self)
        layout.setContentsMargins(5, 2, 5, 2)
        
        # 源路径标签
        self.source_label = QLabel(os.path.basename(source_path))
        self.source_label.setToolTip(f"源: {source_path}")
        self.source_label.setMinimumWidth(150)
        layout.addWidget(self.source_label, 1)
        
        # 箭头
        arrow_label = QLabel("→")
        arrow_label.setStyleSheet("color: #666;")
        layout.addWidget(arrow_label)
        
        # 目标路径输入框
        self.dest_input = QLineEdit(dest_path)
        self.dest_input.setPlaceholderText("目标路径（.表示根目录）")
        self.dest_input.setMinimumWidth(100)
        self.dest_input.setMaximumWidth(150)
        self.dest_input.textChanged.connect(self.update_dest_path)
        self.dest_input.setToolTip("打包后在exe中的路径")
        layout.addWidget(self.dest_input)
        
        # 编辑按钮
        self.edit_btn = QPushButton("编辑")
        self.edit_btn.setMaximumWidth(60)
        self.edit_btn.clicked.connect(self.edit_binary)
        layout.addWidget(self.edit_btn)
        
        # 删除按钮
        self.delete_btn = QPushButton("删除")
        self.delete_btn.setMaximumWidth(60)
        self.delete_btn.clicked.connect(self.delete_binary)
        layout.addWidget(self.delete_btn)
        
        self.setLayout(layout)
    
    def update_dest_path(self, text):
        """更新目标路径"""
        self.dest_path = text.strip() or "."
    
    def edit_binary(self):
        """编辑二进制文件/目录路径"""
        if os.path.isfile(self.source_path):
            file_path, _ = QFileDialog.getOpenFileName(
                self, "选择二进制文件", "", "All Files (*.*)"
            )
            if file_path:
                self.source_path = file_path
                self.source_label.setText(os.path.basename(file_path))
                self.source_label.setToolTip(f"源: {file_path}")
        else:
            dir_path = QFileDialog.getExistingDirectory(
                self, "选择目录", ""
            )
            if dir_path:
                self.source_path = dir_path
                self.source_label.setText(os.path.basename(dir_path) or dir_path)
                self.source_label.setToolTip(f"源: {dir_path}")
    
    def delete_binary(self):
        """删除此二进制文件项"""
        if self.packager:
            self.packager.remove_binary(self)


class DragDropScriptArea(QScrollArea):
    """
    支持拖放的脚本区域
    """
    def __init__(self, parent=None):
        super().__init__(parent)
        self.packager = parent
        self.setAcceptDrops(True)
        self.setWidgetResizable(True)
        
    def dragEnterEvent(self, event: QDragEnterEvent):
        """当拖动进入控件时触发"""
        # 始终接受拖放，在drop事件中再处理
        event.acceptProposedAction()
        
    def dragMoveEvent(self, event):
        """拖动移动事件"""
        # 始终接受拖放，在drop事件中再处理
        event.acceptProposedAction()
    
    def dropEvent(self, event: QDropEvent):
        """当放置文件时触发"""
        added_files = False
        
        # 处理URL类型的拖放（从文件资源管理器）
        if event.mimeData().hasUrls():
            urls = event.mimeData().urls()
            for url in urls:
                file_path = url.toLocalFile()
                if file_path.lower().endswith('.py'):
                    self.packager.add_script_to_list(file_path)
                    added_files = True
        
        # 处理文本类型的拖放（可能是从IDE）
        elif event.mimeData().hasText():
            text = event.mimeData().text().strip()
            
            # 尝试多种可能的路径格式
            potential_paths = [text]
            
            # 如果文本包含路径分隔符和.py，可能是Python文件路径
            if ('/' in text or '\\' in text) and '.py' in text.lower():
                # 尝试提取可能的Python文件路径
                import re
                py_paths = re.findall(r'[a-zA-Z]:[/\\][^"\'<>|:*?\r\n]*\.py', text, re.IGNORECASE)
                py_paths.extend(re.findall(r'(?:/[^/\r\n]+)+\.py', text, re.IGNORECASE))
                potential_paths.extend(py_paths)
                
                # 如果文本以file:///开头，可能是URI格式
                if text.startswith('file:///'):
                    potential_paths.append(text[8:].replace('/', os.path.sep))
            
            # 尝试所有可能的路径
            for path in potential_paths:
                if os.path.exists(path) and path.lower().endswith('.py'):
                    self.packager.add_script_to_list(path)
                    added_files = True
                    break
        
        # 检查所有MIME类型，尝试找到可能的文件路径
        for mime_format in event.mimeData().formats():
            if not added_files and 'text' in mime_format.lower():
                try:
                    data = event.mimeData().data(mime_format).data().decode('utf-8', errors='replace')
                    
                    # 查找可能的Python文件路径
                    if '.py' in data.lower():
                        import re
                        py_paths = re.findall(r'[a-zA-Z]:[/\\][^"\'<>|:*?\r\n]*\.py', data, re.IGNORECASE)
                        py_paths.extend(re.findall(r'(?:/[^/\r\n]+)+\.py', data, re.IGNORECASE))
                        
                        for py_path in py_paths:
                            if os.path.exists(py_path):
                                self.packager.add_script_to_list(py_path)
                                added_files = True
                                break
                except:
                    pass
        
        if added_files:
            event.acceptProposedAction()
        else:
            event.acceptProposedAction()  # 即使没有添加文件也接受事件，避免禁止符号
            # 如果没有添加任何文件，显示提示
            QMessageBox.information(self.packager, "提示", "无法识别拖放的Python文件。请确保拖放的是.py文件。")


class PythonPackager(QMainWindow):
    """
    Python脚本打包器主界面
    """
    def __init__(self):
        super().__init__()
        self.script_widgets = []
        self.binary_widgets = []  # 二进制文件列表
        self.process = None
        self.current_script_index = 0
        self.scripts_to_package = []
        self.package_all = False
        self.package_options = {}
        self.tabs = None  # 保存标签页引用
        self.log_needs_attention = False  # 标记日志是否需要用户关注
        self.is_packaging = False  # 标记是否正在打包中
        
        # 加载配置文件
        self.config = load_config()
        
        self.initUI()
        self.refresh_interpreters()  # 初始化时自动刷新解释器列表
    
    def initUI(self):
        """初始化UI"""
        self.setWindowTitle("Python脚本打包器")
        self.setMinimumWidth(700)
        self.setMinimumHeight(600)
        
        # 主窗口部件
        central_widget = QWidget()
        main_layout = QVBoxLayout(central_widget)
        main_layout.setSpacing(10)
        
        # 创建标签页
        self.tabs = QTabWidget()
        
        # 主页标签
        main_tab = QWidget()
        main_tab_layout = QVBoxLayout(main_tab)
        
        # 脚本列表区域
        scripts_group = QGroupBox("Python脚本列表")
        scripts_layout = QVBoxLayout(scripts_group)
        
        # 添加拖放提示标签
        drag_drop_info = QLabel("可以将Python脚本文件拖放到此区域")
        drag_drop_info.setAlignment(Qt.AlignCenter)
        drag_drop_info.setStyleSheet("color: #666; font-style: italic;")
        scripts_layout.addWidget(drag_drop_info)
        
        # 脚本列表滚动区域 - 改为支持拖放的区域
        self.script_scroll_area = DragDropScriptArea(self)
        
        self.scripts_container = QWidget()
        self.scripts_layout = QVBoxLayout(self.scripts_container)
        self.scripts_layout.setAlignment(Qt.AlignTop)
        self.scripts_layout.setSpacing(5)
        self.scripts_layout.setContentsMargins(0, 0, 0, 0)
        
        self.script_scroll_area.setWidget(self.scripts_container)
        scripts_layout.addWidget(self.script_scroll_area, 1)
        
        # 添加脚本管理按钮布局
        script_buttons_layout = QHBoxLayout()
        
        add_script_btn = QPushButton("添加脚本")
        add_script_btn.clicked.connect(self.add_script)
        script_buttons_layout.addWidget(add_script_btn)
        
        add_folder_btn = QPushButton("添加文件夹中的所有脚本")
        add_folder_btn.clicked.connect(self.add_folder_scripts)
        script_buttons_layout.addWidget(add_folder_btn)
        
        clear_scripts_btn = QPushButton("清空列表")
        clear_scripts_btn.clicked.connect(self.clear_scripts)
        script_buttons_layout.addWidget(clear_scripts_btn)
        
        scripts_layout.addLayout(script_buttons_layout)
        
        main_tab_layout.addWidget(scripts_group, 1)
        
        # 添加主页标签
        self.tabs.addTab(main_tab, "脚本管理")
        
        # 打包选项标签
        options_tab = QWidget()
        options_layout = QVBoxLayout(options_tab)
        
        # Python解释器选择区域
        interpreter_group = QGroupBox("Python解释器")
        interpreter_layout = QVBoxLayout(interpreter_group)
        
        # 添加说明标签
        interpreter_info = QLabel("选择Python解释器（可以指定虚拟环境中的Python，"
                                   "最好就用目标脚本对应的解释器，不然会缺依赖"
                                   )
        interpreter_layout.addWidget(interpreter_info)
        
        interpreter_input_layout = QHBoxLayout()
        
        # 创建Python解释器下拉框
        self.interpreter_combo = QComboBox()
        self.interpreter_combo.setEditable(True)
        self.interpreter_combo.setPlaceholderText("Python解释器路径")
        interpreter_input_layout.addWidget(self.interpreter_combo, 1)
        
        # 刷新解释器列表按钮
        refresh_interpreter_btn = QPushButton("刷新列表")
        refresh_interpreter_btn.clicked.connect(self.refresh_interpreters)
        interpreter_input_layout.addWidget(refresh_interpreter_btn)
        
        browse_interpreter_btn = QPushButton("浏览...")
        browse_interpreter_btn.clicked.connect(self.browse_interpreter)
        interpreter_input_layout.addWidget(browse_interpreter_btn)
        
        interpreter_layout.addLayout(interpreter_input_layout)
        
        # 检查PyInstaller是否已安装的按钮
        buttons_layout = QHBoxLayout()
        
        check_pyinstaller_btn = QPushButton("检查PyInstaller")
        check_pyinstaller_btn.clicked.connect(self.check_pyinstaller)
        buttons_layout.addWidget(check_pyinstaller_btn)
        
        # 安装PyInstaller按钮
        install_pyinstaller_btn = QPushButton("安装PyInstaller")
        install_pyinstaller_btn.clicked.connect(self.install_pyinstaller)
        buttons_layout.addWidget(install_pyinstaller_btn)
        
        interpreter_layout.addLayout(buttons_layout)
        
        options_layout.addWidget(interpreter_group)
        
        # 打包范围选项
        scope_group = QGroupBox("打包范围")
        scope_layout = QVBoxLayout(scope_group)
        
        self.all_scripts_rb = QRadioButton("打包所有脚本")
        self.main_script_rb = QRadioButton("仅打包名为main.py的脚本，不存在则只打包第一个")
        
        self.scope_group = QButtonGroup()
        self.scope_group.addButton(self.all_scripts_rb, 0)
        self.scope_group.addButton(self.main_script_rb, 1)
        self.all_scripts_rb.setChecked(True)  # 默认勾选"打包所有脚本"
        
        scope_layout.addWidget(self.all_scripts_rb)
        scope_layout.addWidget(self.main_script_rb)
        
        # 添加选项说明
        scope_info = QLabel("打包所有脚本时，每个脚本将单独打包成可执行文件。\n"
                           "脚本名称将作为输出文件名。")
        scope_info.setStyleSheet("color: #666; font-size: 10pt;")
        scope_layout.addWidget(scope_info)
        
        options_layout.addWidget(scope_group)
        
        # 基本选项
        basic_group = QGroupBox("基本选项")
        basic_layout = QFormLayout(basic_group)
        
        self.one_file_cb = QCheckBox("生成单个可执行文件")
        self.one_file_cb.setChecked(self.config.get('default_onefile', True))  # 使用配置
        basic_layout.addRow("输出格式:", self.one_file_cb)
        
        self.console_cb = QCheckBox("显示cmd窗口(exe运行会有黑色的cmd来输出信息，关掉就不显示)")
        self.console_cb.setChecked(self.config.get('default_console', True))  # 使用配置
        basic_layout.addRow("控制台:", self.console_cb)
        
        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("留空则使用脚本文件名")
        basic_layout.addRow("应用名称:", self.name_input)
        
        self.output_dir = DragDropLineEdit(accept_dirs=True)
        self.output_dir.setPlaceholderText("选择打包输出目录")
        # 使用配置中的输出目录（完整路径，相对于项目根目录）
        output_dir = self.config.get('build_output_dir', '.misc/.build/dist')
        self.output_dir.setText(os.path.normpath(os.path.join(os.getcwd(), output_dir)))
        
        output_layout = QHBoxLayout()
        output_layout.addWidget(self.output_dir)
        
        browse_output_btn = QPushButton("浏览...")
        browse_output_btn.clicked.connect(self.browse_output_dir)
        output_layout.addWidget(browse_output_btn)
        
        basic_layout.addRow("输出目录:", output_layout)
        
        options_layout.addWidget(basic_group)
        
        # 高级选项
        advanced_group = QGroupBox("高级选项")
        advanced_layout = QFormLayout(advanced_group)
        
        self.clean_cb = QCheckBox("打包前清理")
        self.clean_cb.setChecked(self.config.get('default_clean', True))  # 使用配置
        advanced_layout.addRow("清理:", self.clean_cb)
        
        self.icon_path = DragDropLineEdit(accept_files=True, file_extensions=['.ico'])
        self.icon_path.setPlaceholderText("选择应用图标 (.ico)")
        
        icon_layout = QHBoxLayout()
        icon_layout.addWidget(self.icon_path)
        
        browse_icon_btn = QPushButton("浏览...")
        browse_icon_btn.clicked.connect(self.browse_icon)
        icon_layout.addWidget(browse_icon_btn)
        
        advanced_layout.addRow("应用图标:", icon_layout)
        
        # 添加构建目录和spec文件位置选项（使用配置，完整路径）
        self.build_dir = DragDropLineEdit(accept_dirs=True)
        self.build_dir.setPlaceholderText("构建临时文件目录")
        build_dir = self.config.get('build_temp_dir', '.misc/.build/build')
        self.build_dir.setText(os.path.normpath(os.path.join(os.getcwd(), build_dir)))
        
        build_dir_layout = QHBoxLayout()
        build_dir_layout.addWidget(self.build_dir)
        
        browse_build_dir_btn = QPushButton("浏览...")
        browse_build_dir_btn.clicked.connect(self.browse_build_dir)
        build_dir_layout.addWidget(browse_build_dir_btn)
        
        advanced_layout.addRow("构建目录:", build_dir_layout)
        
        self.spec_dir = DragDropLineEdit(accept_dirs=True)
        self.spec_dir.setPlaceholderText("spec文件目录")
        spec_dir = self.config.get('build_spec_dir', '.misc/.build/spec')
        self.spec_dir.setText(os.path.normpath(os.path.join(os.getcwd(), spec_dir)))
        
        spec_dir_layout = QHBoxLayout()
        spec_dir_layout.addWidget(self.spec_dir)
        
        browse_spec_dir_btn = QPushButton("浏览...")
        browse_spec_dir_btn.clicked.connect(self.browse_spec_dir)
        spec_dir_layout.addWidget(browse_spec_dir_btn)
        
        advanced_layout.addRow("spec文件目录:", spec_dir_layout)
        
        # 配置管理按钮
        config_buttons_layout = QHBoxLayout()
        
        restore_json_btn = QPushButton("恢复json配置路径")
        restore_json_btn.setToolTip("从配置文件中读取路径并应用到界面")
        restore_json_btn.clicked.connect(self.restore_paths_from_json)
        config_buttons_layout.addWidget(restore_json_btn)
        
        restore_default_btn = QPushButton("恢复默认配置路径")
        restore_default_btn.setToolTip("使用代码中的默认配置路径")
        restore_default_btn.clicked.connect(self.restore_default_paths)
        config_buttons_layout.addWidget(restore_default_btn)
        
        save_to_json_btn = QPushButton("保存路径到json")
        save_to_json_btn.setToolTip("将当前界面中的路径保存到配置文件")
        save_to_json_btn.clicked.connect(self.save_paths_to_json)
        config_buttons_layout.addWidget(save_to_json_btn)
        
        advanced_layout.addRow("配置管理:", config_buttons_layout)
        
        options_layout.addWidget(advanced_group)
        options_layout.addStretch()
        
        # 添加打包选项标签
        self.tabs.addTab(options_tab, "打包选项")
        
        # 打包参数标签页
        params_tab = QWidget()
        params_layout = QVBoxLayout(params_tab)
        
        # 额外数据输入框
        extra_data_group = QGroupBox("额外数据 (--add-data)")
        extra_data_layout = QVBoxLayout(extra_data_group)
        
        extra_data_info = QLabel("每行一个参数，例如：\n"
                                  "--add-data \"source_folder;dest_folder\"\n"
                                  "--add-data \"config.json;.\"\n"
                                  "--add-data \"resources;resources\"")
        extra_data_info.setStyleSheet("color: #666; font-size: 9pt;")
        extra_data_layout.addWidget(extra_data_info)
        
        self.extra_data = QTextEdit()
        self.extra_data.setPlaceholderText("每行输入一个 --add-data 参数")
        self.extra_data.setMinimumHeight(120)
        # 从配置中读取额外数据参数
        self.extra_data.setPlainText(self.config.get('extra_data', ''))
        extra_data_layout.addWidget(self.extra_data)
        
        params_layout.addWidget(extra_data_group)
        
        # 其他参数输入框
        extra_args_group = QGroupBox("其他PyInstaller参数")
        extra_args_layout = QVBoxLayout(extra_args_group)
        
        extra_args_info = QLabel("每行一个参数，例如：\n"
                                 "--hidden-import=numpy\n"
                                 "--collect-all=pkg_name\n"
                                 "--exclude-module=tkinter")
        extra_args_info.setStyleSheet("color: #666; font-size: 9pt;")
        extra_args_layout.addWidget(extra_args_info)
        
        self.extra_args = QTextEdit()
        self.extra_args.setPlaceholderText("每行输入一个PyInstaller参数")
        self.extra_args.setMinimumHeight(120)
        # 从配置中读取其他参数
        self.extra_args.setPlainText(self.config.get('extra_args', ''))
        extra_args_layout.addWidget(self.extra_args)
        
        params_layout.addWidget(extra_args_group)
        
        # 添加保存按钮
        save_params_group = QGroupBox("参数管理")
        save_params_layout = QHBoxLayout(save_params_group)
        
        save_params_btn = QPushButton("保存额外参数到配置文件")
        save_params_btn.setToolTip("将当前输入的额外参数保存到 .config/mypackager.json")
        save_params_btn.clicked.connect(self.save_extra_params_to_json)
        save_params_layout.addWidget(save_params_btn)
        
        restore_params_btn = QPushButton("从配置文件恢复")
        restore_params_btn.setToolTip("从 .config/mypackager.json 重新加载额外参数")
        restore_params_btn.clicked.connect(self.restore_extra_params_from_json)
        save_params_layout.addWidget(restore_params_btn)
        
        params_layout.addWidget(save_params_group)
        params_layout.addStretch()
        
        # 添加打包参数标签
        self.tabs.addTab(params_tab, "打包参数")
        
        # 二进制文件管理标签页
        binary_tab = QWidget()
        binary_layout = QVBoxLayout(binary_tab)
        
        # 说明区域
        binary_info_group = QGroupBox("说明")
        binary_info_layout = QVBoxLayout(binary_info_group)
        
        info_text = QLabel(
            "此功能用于将二进制文件（如.exe、.dll等）打包到最终的exe中。\n\n"
            "使用场景：\n"
            "• 打包第三方工具（如pandoc.exe）\n"
            "• 打包动态链接库（.dll文件）\n"
            "• 打包整个工具目录\n\n"
            "源路径：要打包的文件或目录路径\n"
            "目标路径：打包后在exe中的相对路径（.表示根目录）"
        )
        info_text.setStyleSheet("color: #666; font-size: 9pt;")
        info_text.setWordWrap(True)
        binary_info_layout.addWidget(info_text)
        
        binary_layout.addWidget(binary_info_group)
        
        # 二进制文件列表区域
        binary_list_group = QGroupBox("二进制文件列表")
        binary_list_layout = QVBoxLayout(binary_list_group)
        
        # 提示标签
        binary_hint = QLabel("添加需要打包的二进制文件或目录")
        binary_hint.setAlignment(Qt.AlignCenter)
        binary_hint.setStyleSheet("color: #666; font-style: italic;")
        binary_list_layout.addWidget(binary_hint)
        
        # 二进制文件列表滚动区域
        self.binary_scroll_area = QScrollArea()
        self.binary_scroll_area.setWidgetResizable(True)
        
        self.binaries_container = QWidget()
        self.binaries_layout = QVBoxLayout(self.binaries_container)
        self.binaries_layout.setAlignment(Qt.AlignTop)
        self.binaries_layout.setSpacing(5)
        self.binaries_layout.setContentsMargins(0, 0, 0, 0)
        
        self.binary_scroll_area.setWidget(self.binaries_container)
        binary_list_layout.addWidget(self.binary_scroll_area, 1)
        
        # 添加二进制文件管理按钮布局
        binary_buttons_layout = QHBoxLayout()
        
        add_binary_file_btn = QPushButton("添加文件")
        add_binary_file_btn.setToolTip("添加单个二进制文件（如pandoc.exe）")
        add_binary_file_btn.clicked.connect(self.add_binary_file)
        binary_buttons_layout.addWidget(add_binary_file_btn)
        
        add_binary_dir_btn = QPushButton("添加目录")
        add_binary_dir_btn.setToolTip("添加整个目录（如pandoc文件夹）")
        add_binary_dir_btn.clicked.connect(self.add_binary_directory)
        binary_buttons_layout.addWidget(add_binary_dir_btn)
        
        clear_binaries_btn = QPushButton("清空列表")
        clear_binaries_btn.clicked.connect(self.clear_binaries)
        binary_buttons_layout.addWidget(clear_binaries_btn)
        
        binary_list_layout.addLayout(binary_buttons_layout)
        
        binary_layout.addWidget(binary_list_group, 1)
        
        # 依赖分析区域
        deps_group = QGroupBox("依赖分析（高级）")
        deps_layout = QVBoxLayout(deps_group)
        
        deps_info = QLabel(
            "自动分析二进制文件的依赖项（需要pefile库）。\n"
            "分析后会自动添加所有依赖的DLL文件。"
        )
        deps_info.setStyleSheet("color: #666; font-size: 9pt;")
        deps_info.setWordWrap(True)
        deps_layout.addWidget(deps_info)
        
        analyze_deps_btn = QPushButton("分析当前列表的依赖")
        analyze_deps_btn.setToolTip("分析列表中二进制文件的所有依赖项")
        analyze_deps_btn.clicked.connect(self.analyze_binary_dependencies)
        deps_layout.addWidget(analyze_deps_btn)
        
        binary_layout.addWidget(deps_group)
        
        # 添加保存/恢复按钮
        binary_config_group = QGroupBox("配置管理")
        binary_config_layout = QHBoxLayout(binary_config_group)
        
        save_binary_btn = QPushButton("保存到配置文件")
        save_binary_btn.setToolTip("将当前二进制文件列表保存到配置")
        save_binary_btn.clicked.connect(self.save_binaries_to_config)
        binary_config_layout.addWidget(save_binary_btn)
        
        restore_binary_btn = QPushButton("从配置文件恢复")
        restore_binary_btn.setToolTip("从配置文件加载二进制文件列表")
        restore_binary_btn.clicked.connect(self.restore_binaries_from_config)
        binary_config_layout.addWidget(restore_binary_btn)
        
        binary_layout.addWidget(binary_config_group)
        
        # 添加二进制文件管理标签
        self.tabs.addTab(binary_tab, "二进制文件")
        
        # 日志标签
        log_tab = QWidget()
        log_layout = QVBoxLayout(log_tab)
        
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        log_layout.addWidget(self.log_text)
        
        # 添加日志标签，并保存索引
        self.log_tab_index = self.tabs.addTab(log_tab, "打包日志")
        
        # 连接标签页切换事件，用于取消日志高亮
        self.tabs.currentChanged.connect(self.on_tab_changed)
        
        # 添加标签页到主布局
        main_layout.addWidget(self.tabs)
        
        # 打包按钮
        self.package_btn = QPushButton("打包脚本")
        self.package_btn.setMinimumHeight(40)
        self.package_btn.clicked.connect(self.package_scripts)
        main_layout.addWidget(self.package_btn)
        
        # 终止打包按钮（初始隐藏）
        self.stop_btn = QPushButton("终止打包")
        self.stop_btn.setMinimumHeight(40)
        self.stop_btn.setStyleSheet("background-color: #d9534f; color: white;")
        self.stop_btn.clicked.connect(self.stop_packaging)
        self.stop_btn.hide()  # 初始隐藏
        main_layout.addWidget(self.stop_btn)
        
        self.setCentralWidget(central_widget)
        self.show()
    
    def stop_packaging(self):
        """终止打包进程"""
        if not self.is_packaging or not self.process:
            return
            
        # 弹出确认对话框
        reply = QMessageBox.question(self, "确认", "确定要终止当前打包进程吗？", 
                                    QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if reply != QMessageBox.Yes:
            return
            
        # 终止进程
        self.process.kill()
        
        # 添加日志
        self.log_text.append("\n打包进程已被用户终止")
        
        # 重置状态
        self.is_packaging = False
        self.stop_btn.hide()
        self.package_btn.show()
        
        # 高亮日志标签页（蓝色）
        self.log_needs_attention = True
        self.highlight_log_tab(True, color='blue')
    
    def on_tab_changed(self, index):
        """标签页切换事件处理"""
        # 如果切换到日志标签页，且不在打包过程中，取消高亮
        if index == self.log_tab_index and self.log_needs_attention and not self.is_packaging:
            self.log_needs_attention = False
            self.highlight_log_tab(False)
        # 如果在打包过程中，保持绿色高亮
        elif index == self.log_tab_index and self.is_packaging:
            self.highlight_log_tab(True, color='green')
    
    def browse_interpreter(self):
        """浏览选择Python解释器"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择Python解释器", "", "Executable Files (*.exe);;All Files (*)"
        )
        if file_path:
            # 添加到下拉框并选中
            if self.interpreter_combo.findText(file_path) == -1:
                self.interpreter_combo.addItem(file_path)
            self.interpreter_combo.setCurrentText(file_path)
    
    def refresh_interpreters(self):
        """刷新Python解释器列表"""
        self.interpreter_combo.clear()
        
        # 获取当前执行脚本的Python解释器
        current_python = os.path.normpath(os.path.abspath(sys.executable))
        
        # 获取当前工作目录（规范化）
        current_dir = os.path.normpath(os.path.abspath(os.getcwd()))
        
        # 查找所有系统Python解释器
        interpreters = self.find_python_interpreters()
        
        # 查找当前目录的虚拟环境解释器
        current_dir_venv = None
        venv_dirs = self.config.get('venv_search_dirs', ['.venv', 'venv'])
        for interpreter in interpreters:
            normalized_interpreter = os.path.normpath(os.path.abspath(interpreter))
            # 检查解释器是否在当前目录下的虚拟环境中
            if current_dir in normalized_interpreter:
                # 检查是否包含虚拟环境关键词
                for venv_dir in venv_dirs:
                    if venv_dir in normalized_interpreter:
                        current_dir_venv = interpreter
                        break
                if current_dir_venv:
                    break
        
        # 排序优先级：
        # 1. 当前目录的虚拟环境（最优先）
        # 2. 当前执行的Python解释器
        # 3. 其他解释器
        final_interpreters = []
        
        # 添加当前目录的虚拟环境（如果存在）
        if current_dir_venv:
            final_interpreters.append(current_dir_venv)
        
        # 添加当前Python解释器（如果不是当前目录的虚拟环境）
        if current_python not in [os.path.normpath(os.path.abspath(i)) for i in final_interpreters]:
            final_interpreters.append(current_python)
        
        # 添加其他解释器
        for interpreter in interpreters:
            normalized = os.path.normpath(os.path.abspath(interpreter))
            if normalized not in [os.path.normpath(os.path.abspath(i)) for i in final_interpreters]:
                final_interpreters.append(interpreter)
        
        # 添加到下拉框
        for interpreter in final_interpreters:
            self.interpreter_combo.addItem(interpreter)
        
        # 默认选择第一个（当前目录虚拟环境或当前Python解释器）
        if self.interpreter_combo.count() > 0:
            self.interpreter_combo.setCurrentIndex(0)
    
    def find_python_interpreters(self):
        """查找系统中安装的Python解释器"""
        import glob
        interpreters = []
        
        # 获取当前目录（规范化）
        current_dir = os.path.normpath(os.path.abspath(os.getcwd()))
        
        # 如果是打包后的EXE，尝试使用脚本所在目录（规范化）
        script_dir = os.path.normpath(os.path.abspath(os.path.dirname(sys.argv[0])))
        
        # 查找虚拟环境
        venv_paths = []
        
        # 要检查的目录列表 - 移除重复的目录
        dirs_to_check = []
        for d in [current_dir, script_dir]:
            normalized_path = os.path.normpath(d)
            if normalized_path not in dirs_to_check and os.path.exists(d):
                dirs_to_check.append(normalized_path)
        
        # 添加父目录（使用配置）
        parent_depth = self.config.get('parent_dir_search_depth', 0)
        for base_dir in list(dirs_to_check):  # 使用列表的副本进行迭代
            for i in range(parent_depth):
                parent_dir = os.path.normpath(os.path.abspath(os.path.join(base_dir, *(['..'] * (i+1)))))
                if parent_dir not in dirs_to_check and os.path.exists(parent_dir):
                    dirs_to_check.append(parent_dir)
        
        # 在所有目录中查找虚拟环境（使用配置）
        venv_dirs = self.config.get('venv_search_dirs', ['.venv', 'venv'])
        for check_dir in dirs_to_check:
            if not os.path.exists(check_dir):
                continue
                
            for venv_dir in venv_dirs:
                # Windows路径 - 使用 normpath 规范化
                venv_path = os.path.normpath(os.path.join(check_dir, venv_dir, 'Scripts', 'python.exe'))
                if os.path.exists(venv_path):
                    normalized_path = os.path.normcase(os.path.normpath(venv_path))
                    if normalized_path not in [os.path.normcase(os.path.normpath(p)) for p in venv_paths]:
                        venv_paths.append(venv_path)
                
                # 使用通配符匹配带任意版本号的虚拟环境目录（如 venv310, venv311, venv40 等）
                # 这样无论Python出什么新版本都能自动识别
                versioned_pattern = os.path.join(check_dir, f"{venv_dir}*", 'Scripts', 'python.exe')
                versioned_matches = glob.glob(versioned_pattern)
                for match in versioned_matches:
                    # 规范化路径
                    match = os.path.normpath(os.path.abspath(match))
                    normalized_path = os.path.normcase(match)
                    if normalized_path not in [os.path.normcase(os.path.normpath(p)) for p in venv_paths]:
                        venv_paths.append(match)
        
        # 使用glob查找匹配的系统Python解释器（使用配置）
        python_paths = self.config.get('python_search_paths', [])
        for path_pattern in python_paths:
            matches = glob.glob(path_pattern)
            for match in matches:
                # 规范化路径
                match = os.path.normpath(os.path.abspath(match))
                normalized_path = os.path.normcase(match)
                if normalized_path not in [os.path.normcase(os.path.normpath(p)) for p in interpreters]:
                    interpreters.append(match)
        
        # 添加找到的虚拟环境解释器
        for venv_path in venv_paths:
            normalized_path = os.path.normcase(os.path.normpath(venv_path))
            if normalized_path not in [os.path.normcase(os.path.normpath(p)) for p in interpreters]:
                interpreters.append(venv_path)
        
        # 检查系统PATH中的Python
        try:
            which_python = subprocess.check_output(["where", "python"], text=True, stderr=subprocess.DEVNULL)
            for path in which_python.strip().split('\n'):
                if path:
                    # 规范化路径
                    path = os.path.normpath(os.path.abspath(path))
                    normalized_path = os.path.normcase(path)
                    if normalized_path not in [os.path.normcase(os.path.normpath(p)) for p in interpreters]:
                        interpreters.append(path)
        except (subprocess.SubprocessError, FileNotFoundError):
            pass
        
        # 去重并排序 - 使用规范化路径进行比较
        unique_interpreters = []
        normalized_paths = []
        
        for path in interpreters:
            normalized_path = os.path.normcase(os.path.normpath(path))
            if normalized_path not in normalized_paths:
                normalized_paths.append(normalized_path)
                unique_interpreters.append(path)
        
        interpreters = sorted(unique_interpreters)
        
        # 将虚拟环境解释器排在前面（使用配置中的关键词）
        venv_dirs = self.config.get('venv_search_dirs', ['.venv', 'venv'])
        venv_keywords = [v.lower() for v in venv_dirs]
        venv_interpreters = [i for i in interpreters if any(keyword in i.lower() for keyword in venv_keywords)]
        other_interpreters = [i for i in interpreters if i not in venv_interpreters]
        
        # 统一转换为大写盘符显示
        result = []
        for path in venv_interpreters + other_interpreters:
            if path and len(path) > 1 and path[1] == ':':
                path = path[0].upper() + path[1:]
            result.append(path)
            
        return result
        
    def get_interpreter_path(self):
        """获取当前选择的解释器路径"""
        return self.interpreter_combo.currentText().strip()
    
    def add_script(self):
        """添加Python脚本到列表"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择Python脚本", "", "Python Files (*.py)"
        )
        if file_path:
            self.add_script_to_list(file_path)
    
    def add_folder_scripts(self):
        """添加文件夹中的所有Python脚本"""
        folder_path = QFileDialog.getExistingDirectory(
            self, "选择包含Python脚本的文件夹", ""
        )
        if not folder_path:
            return
        
        python_files = []
        # 遍历文件夹查找所有.py文件
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                if file.lower().endswith('.py'):
                    python_files.append(os.path.join(root, file))
        
        if not python_files:
            QMessageBox.information(self, "信息", f"在所选文件夹中未找到Python脚本。")
            return
        
        # 添加找到的所有Python脚本
        for py_file in python_files:
            self.add_script_to_list(py_file)
        
        QMessageBox.information(self, "信息", f"已添加 {len(python_files)} 个Python脚本。")
    
    def clear_scripts(self):
        """清空脚本列表"""
        if not self.script_widgets:
            return
            
        reply = QMessageBox.question(
            self, "确认", "确定要清空脚本列表吗？",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            for widget in self.script_widgets[:]:
                self.remove_script(widget)
    
    def add_script_to_list(self, script_path):
        """向列表添加脚本项"""
        # 检查是否已经在列表中
        for widget in self.script_widgets:
            if widget.script_path == script_path:
                return  # 已存在，不重复添加
                
        script_widget = ScriptItemWidget(script_path, self)
        self.script_widgets.append(script_widget)
        self.scripts_layout.addWidget(script_widget)
    
    def remove_script(self, script_widget):
        """从列表中删除脚本项"""
        if script_widget in self.script_widgets:
            self.script_widgets.remove(script_widget)
            self.scripts_layout.removeWidget(script_widget)
            script_widget.deleteLater()
    
    def update_script_list(self):
        """更新脚本列表"""
        # 仅在需要时重新排列或更新脚本列表
        pass
    
    def browse_output_dir(self):
        """浏览选择输出目录"""
        dir_path = QFileDialog.getExistingDirectory(
            self, "选择输出目录", ""
        )
        if dir_path:
            self.output_dir.setText(dir_path)
    
    def browse_icon(self):
        """浏览选择应用图标"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择图标文件", "", "Icon Files (*.ico)"
        )
        if file_path:
            self.icon_path.setText(file_path)
    
    def browse_build_dir(self):
        """浏览选择构建目录"""
        dir_path = QFileDialog.getExistingDirectory(
            self, "选择构建目录", ""
        )
        if dir_path:
            self.build_dir.setText(dir_path)
    
    def browse_spec_dir(self):
        """浏览选择spec文件目录"""
        dir_path = QFileDialog.getExistingDirectory(
            self, "选择spec文件目录", ""
        )
        if dir_path:
            self.spec_dir.setText(dir_path)
    
    def restore_paths_from_json(self):
        """从json配置文件恢复路径"""
        try:
            # 重新加载配置
            self.config = load_config()
            
            # 应用配置到界面
            output_dir = self.config.get('build_output_dir', 'dist')
            self.output_dir.setText(os.path.normpath(os.path.join(os.getcwd(), output_dir)))
            
            build_dir = self.config.get('build_temp_dir', '.misc/.build/build')
            self.build_dir.setText(os.path.normpath(os.path.join(os.getcwd(), build_dir)))
            
            spec_dir = self.config.get('build_spec_dir', '.misc/.build/spec')
            self.spec_dir.setText(os.path.normpath(os.path.join(os.getcwd(), spec_dir)))
            
            QMessageBox.information(self, "成功", "已从配置文件恢复路径设置")
        except Exception as e:
            QMessageBox.warning(self, "错误", f"恢复配置失败: {e}")
    
    def restore_default_paths(self):
        """恢复为默认配置路径（使用代码中的DEFAULT_CONFIG）"""
        try:
            # 应用默认配置到界面
            output_dir = DEFAULT_CONFIG.get('build_output_dir', 'dist')
            self.output_dir.setText(os.path.normpath(os.path.join(os.getcwd(), output_dir)))
            
            build_dir = DEFAULT_CONFIG.get('build_temp_dir', '.misc/.build/build')
            self.build_dir.setText(os.path.normpath(os.path.join(os.getcwd(), build_dir)))
            
            spec_dir = DEFAULT_CONFIG.get('build_spec_dir', '.misc/.build/spec')
            self.spec_dir.setText(os.path.normpath(os.path.join(os.getcwd(), spec_dir)))
            
            QMessageBox.information(self, "成功", "已恢复为默认配置路径")
        except Exception as e:
            QMessageBox.warning(self, "错误", f"恢复默认配置失败: {e}")
    
    def save_paths_to_json(self):
        """将当前界面中的路径保存到json配置文件"""
        try:
            import json
            
            # 获取当前界面的路径（转换为相对路径）
            cwd = os.getcwd()
            output_dir = self.output_dir.text().strip()
            build_dir = self.build_dir.text().strip()
            spec_dir = self.spec_dir.text().strip()
            
            # 转换为相对路径
            if output_dir:
                output_dir_rel = os.path.relpath(output_dir, cwd)
            else:
                output_dir_rel = DEFAULT_CONFIG['build_output_dir']
            
            if build_dir:
                build_dir_rel = os.path.relpath(build_dir, cwd)
            else:
                build_dir_rel = DEFAULT_CONFIG['build_temp_dir']
            
            if spec_dir:
                spec_dir_rel = os.path.relpath(spec_dir, cwd)
            else:
                spec_dir_rel = DEFAULT_CONFIG['build_spec_dir']
            
            # 更新配置
            self.config['build_output_dir'] = output_dir_rel
            self.config['build_temp_dir'] = build_dir_rel
            self.config['build_spec_dir'] = spec_dir_rel
            
            # 保存到文件
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, ensure_ascii=False, indent=4)
            
            QMessageBox.information(self, "成功", f"路径配置已保存到 {CONFIG_FILE}\n\n"
                                  f"输出目录: {output_dir_rel}\n"
                                  f"构建目录: {build_dir_rel}\n"
                                  f"spec目录: {spec_dir_rel}")
        except Exception as e:
            QMessageBox.warning(self, "错误", f"保存配置失败: {e}")
    
    def save_extra_params_to_json(self):
        """将当前输入的额外参数保存到json配置文件"""
        try:
            import json
            
            # 获取当前界面的额外参数
            extra_data = self.extra_data.toPlainText().strip()
            extra_args = self.extra_args.toPlainText().strip()
            
            # 更新配置
            self.config['extra_data'] = extra_data
            self.config['extra_args'] = extra_args
            
            # 保存到文件
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, ensure_ascii=False, indent=4)
            
            QMessageBox.information(self, "成功", f"额外参数已保存到 {CONFIG_FILE}")
        except Exception as e:
            QMessageBox.warning(self, "错误", f"保存额外参数失败: {e}")
    
    def restore_extra_params_from_json(self):
        """从json配置文件重新加载额外参数"""
        try:
            # 重新加载配置
            self.config = load_config()
            
            # 更新界面
            self.extra_data.setPlainText(self.config.get('extra_data', ''))
            self.extra_args.setPlainText(self.config.get('extra_args', ''))
            
            QMessageBox.information(self, "成功", f"额外参数已从 {CONFIG_FILE} 恢复")
        except Exception as e:
            QMessageBox.warning(self, "错误", f"恢复额外参数失败: {e}")
    
    # ==================== 二进制文件管理方法 ====================
    
    def add_binary_file(self):
        """添加二进制文件"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择二进制文件", "", "All Files (*.*)"
        )
        if file_path:
            self.add_binary_to_list(file_path, ".")
    
    def add_binary_directory(self):
        """添加二进制文件目录"""
        dir_path = QFileDialog.getExistingDirectory(
            self, "选择目录", ""
        )
        if dir_path:
            # 目录名作为目标路径
            dir_name = os.path.basename(dir_path)
            self.add_binary_to_list(dir_path, dir_name)
    
    def add_binary_to_list(self, source_path, dest_path="."):
        """向列表添加二进制文件项"""
        # 检查是否已经在列表中
        for widget in self.binary_widgets:
            if widget.source_path == source_path:
                return  # 已存在，不重复添加
        
        binary_widget = BinaryItemWidget(source_path, dest_path, self)
        self.binary_widgets.append(binary_widget)
        self.binaries_layout.addWidget(binary_widget)
    
    def remove_binary(self, binary_widget):
        """从列表中删除二进制文件项"""
        if binary_widget in self.binary_widgets:
            self.binary_widgets.remove(binary_widget)
            self.binaries_layout.removeWidget(binary_widget)
            binary_widget.deleteLater()
    
    def clear_binaries(self):
        """清空二进制文件列表"""
        if not self.binary_widgets:
            return
        
        reply = QMessageBox.question(
            self, "确认", "确定要清空二进制文件列表吗？",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            for widget in self.binary_widgets[:]:
                self.remove_binary(widget)
    
    def save_binaries_to_config(self):
        """将二进制文件列表保存到配置"""
        try:
            import json
            
            # 构建二进制文件列表
            binaries = []
            for widget in self.binary_widgets:
                binaries.append({
                    "source": widget.source_path,
                    "dest": widget.dest_path
                })
            
            # 更新配置
            self.config['binary_files'] = binaries
            
            # 保存到文件
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, ensure_ascii=False, indent=4)
            
            QMessageBox.information(
                self, "成功", 
                f"已保存 {len(binaries)} 个二进制文件配置到 {CONFIG_FILE}"
            )
        except Exception as e:
            QMessageBox.warning(self, "错误", f"保存二进制文件配置失败: {e}")
    
    def restore_binaries_from_config(self):
        """从配置文件恢复二进制文件列表"""
        try:
            # 重新加载配置
            self.config = load_config()
            
            # 清空现有列表
            for widget in self.binary_widgets[:]:
                self.remove_binary(widget)
            
            # 恢复二进制文件列表
            binaries = self.config.get('binary_files', [])
            for binary in binaries:
                source = binary.get('source', '')
                dest = binary.get('dest', '.')
                if source and os.path.exists(source):
                    self.add_binary_to_list(source, dest)
            
            QMessageBox.information(
                self, "成功", 
                f"已从 {CONFIG_FILE} 恢复 {len(binaries)} 个二进制文件配置"
            )
        except Exception as e:
            QMessageBox.warning(self, "错误", f"恢复二进制文件配置失败: {e}")
    
    def analyze_binary_dependencies(self):
        """分析二进制文件的依赖项"""
        if not self.binary_widgets:
            QMessageBox.information(self, "提示", "请先添加二进制文件")
            return
        
        try:
            # 检查是否安装了pefile
            import pefile
        except ImportError:
            reply = QMessageBox.question(
                self, "缺少依赖", 
                "依赖分析需要pefile库。是否现在安装？\n"
                "将执行: pip install pefile",
                QMessageBox.Yes | QMessageBox.No, QMessageBox.Yes
            )
            
            if reply == QMessageBox.Yes:
                self.install_pefile()
            return
        
        # 收集所有二进制文件路径
        binary_files = []
        search_dirs = set()
        
        for widget in self.binary_widgets:
            source_path = widget.source_path
            if os.path.isfile(source_path):
                binary_files.append(source_path)
                search_dirs.add(os.path.dirname(source_path))
            elif os.path.isdir(source_path):
                # 扫描目录中的所有 .exe 和 .dll 文件
                for root, dirs, files in os.walk(source_path):
                    for file in files:
                        if file.lower().endswith(('.exe', '.dll')):
                            file_path = os.path.join(root, file)
                            binary_files.append(file_path)
                            search_dirs.add(root)
        
        if not binary_files:
            QMessageBox.information(self, "提示", "没有找到可分析的二进制文件")
            return
        
        # 开始分析
        self.log_text.clear()
        self.log_text.append(f"开始分析 {len(binary_files)} 个二进制文件的依赖项...\n")
        self.tabs.setCurrentIndex(self.log_tab_index)
        QApplication.processEvents()
        
        # 调用binary_dep_analyzer的逻辑
        try:
            from binary_dep_analyzer import get_imported_dlls, collect_all_deps
            
            deps = collect_all_deps(binary_files, list(search_dirs))
            
            # 过滤掉已经在列表中的文件
            existing_paths = {os.path.normcase(os.path.normpath(w.source_path)) 
                            for w in self.binary_widgets}
            
            new_deps = []
            for dep in deps:
                normalized = os.path.normcase(os.path.normpath(dep))
                if normalized not in existing_paths and os.path.exists(dep):
                    new_deps.append(dep)
            
            if new_deps:
                self.log_text.append(f"\n发现 {len(new_deps)} 个新的依赖文件：")
                for dep in new_deps:
                    self.log_text.append(f"  - {dep}")
                
                # 询问是否添加
                reply = QMessageBox.question(
                    self, "发现依赖", 
                    f"发现 {len(new_deps)} 个依赖文件，是否添加到列表？",
                    QMessageBox.Yes | QMessageBox.No, QMessageBox.Yes
                )
                
                if reply == QMessageBox.Yes:
                    for dep in new_deps:
                        # 依赖文件放到根目录
                        self.add_binary_to_list(dep, ".")
                    
                    self.log_text.append(f"\n已添加 {len(new_deps)} 个依赖文件到列表")
                    QMessageBox.information(self, "完成", f"已添加 {len(new_deps)} 个依赖文件")
            else:
                self.log_text.append("\n未发现新的依赖文件")
                QMessageBox.information(self, "完成", "未发现新的依赖文件")
                
        except Exception as e:
            self.log_text.append(f"\n分析失败: {str(e)}")
            QMessageBox.warning(self, "错误", f"依赖分析失败: {e}")
    
    def install_pefile(self):
        """安装pefile库"""
        interpreter_path = self.get_interpreter_path()
        if not interpreter_path:
            QMessageBox.warning(self, "错误", "请先选择Python解释器")
            return
        
        self.log_text.clear()
        self.log_text.append("正在安装pefile库...\n")
        self.tabs.setCurrentIndex(self.log_tab_index)
        
        # 启动安装进程
        self.process = QProcess()
        self.process.readyReadStandardOutput.connect(self.process_output)
        self.process.readyReadStandardError.connect(self.process_error)
        self.process.finished.connect(self.on_pefile_install_finished)
        
        cmd = f'"{interpreter_path}" -m pip install pefile'
        self.process.start(cmd)
    
    def on_pefile_install_finished(self, exit_code, exit_status):
        """pefile安装完成"""
        if exit_code == 0:
            self.log_text.append("\npefile安装成功！现在可以使用依赖分析功能了。")
            QMessageBox.information(self, "成功", "pefile库安装成功！")
        else:
            self.log_text.append("\npefile安装失败，请检查错误信息")
            QMessageBox.warning(self, "失败", "pefile库安装失败")
    
    def install_pyinstaller(self):
        """安装PyInstaller"""
        interpreter_path = self.get_interpreter_path()
        if not interpreter_path:
            QMessageBox.warning(self, "错误", "请先选择Python解释器路径")
            return
        
        if not os.path.exists(interpreter_path):
            QMessageBox.warning(self, "错误", "Python解释器路径不存在")
            return
        
        # 保存安装按钮引用，用于后续恢复状态
        self.install_button = self.sender()
        if self.install_button:
            self.install_button.setEnabled(False)
            self.install_button.setText("正在检查...")
            QApplication.processEvents()  # 立即更新UI
        
        # 使用现有的check_pyinstaller函数进行检查
        # 修改process_finished处理函数，使其在检查完成后调用安装逻辑
        self.original_process_finished = self.process_finished
        self.process_finished = self.check_and_install_pyinstaller
        
        # 调用检查函数
        self.check_pyinstaller()
    
    def check_and_install_pyinstaller(self, exit_code, exit_status):
        """检查PyInstaller后决定是否需要安装"""
        # 恢复原始的process_finished处理函数
        self.process_finished = self.original_process_finished
        
        if exit_code == 0:
            # PyInstaller已安装，无需安装
            self.log_text.append("\nPyInstaller已经安装，无需重新安装")
            if hasattr(self, 'install_button') and self.install_button:
                self.install_button.setEnabled(True)
                self.install_button.setText("安装PyInstaller")
        else:
            # PyInstaller未安装，开始安装
            self.log_text.append("\nPyInstaller未安装，开始安装...")
            
            # 更新按钮状态
            if hasattr(self, 'install_button') and self.install_button:
                self.install_button.setText("正在安装...")
                QApplication.processEvents()  # 立即更新UI
            
            # 启动进程安装PyInstaller
            self.process = QProcess()
            self.process.readyReadStandardOutput.connect(self.process_output)
            self.process.readyReadStandardError.connect(self.process_error)
            self.process.finished.connect(self.on_pyinstaller_install_finished)
            
            # 执行命令: python -m pip install pyinstaller
            cmd = f'"{self.get_interpreter_path()}" -m pip install pyinstaller'
            self.process.start(cmd)
    
    def on_pyinstaller_install_finished(self, exit_code, exit_status):
        """PyInstaller安装完成后的处理"""
        if exit_code == 0:
            self.log_text.append("\nPyInstaller安装成功！")
            # 安装成功后自动检查版本
            self.check_pyinstaller()
        else:
            self.log_text.append("\nPyInstaller安装失败，请检查错误信息")
        
        # 恢复按钮状态
        if hasattr(self, 'install_button') and self.install_button:
            self.install_button.setEnabled(True)
            self.install_button.setText("安装PyInstaller")
            delattr(self, 'install_button')  # 清理引用
    
    def check_pyinstaller(self):
        """检查是否安装PyInstaller"""
        interpreter_path = self.get_interpreter_path()
        if not interpreter_path:
            QMessageBox.warning(self, "错误", "请先选择Python解释器路径")
            return
        
        if not os.path.exists(interpreter_path):
            QMessageBox.warning(self, "错误", "Python解释器路径不存在")
            return
        
        self.log_text.clear()
        self.log_text.append("正在检查PyInstaller...")
        
        # 切换到日志标签页
        self.tabs.setCurrentIndex(self.log_tab_index)
        
        # 启动进程检查PyInstaller
        self.process = QProcess()
        self.process.readyReadStandardOutput.connect(self.process_output)
        self.process.readyReadStandardError.connect(self.process_error)
        self.process.finished.connect(self.process_finished)
        
        # 执行命令: python -c "import PyInstaller; print('PyInstaller version:', PyInstaller.__version__)"
        cmd = f'"{interpreter_path}" -c "import PyInstaller; print(\'PyInstaller version:\', PyInstaller.__version__)"'
        self.process.start(cmd)
    
    def process_output(self):
        """处理进程标准输出"""
        data = self.process.readAllStandardOutput().data().decode('utf-8', errors='replace')
        self.log_text.append(data)
    
    def process_error(self):
        """处理进程标准错误"""
        data = self.process.readAllStandardError().data().decode('utf-8', errors='replace')
        self.log_text.append(data)
        
        # 如果包含ImportError，提示安装PyInstaller
        if "ImportError" in data or "ModuleNotFoundError" in data:
            self.log_text.append("\nPyInstaller未安装，可以点击\"安装PyInstaller\"按钮进行安装")
            self.log_text.append(f'或者手动安装: "{self.get_interpreter_path()}" -m pip install pyinstaller')
    
    def process_finished(self, exit_code, exit_status):
        """进程结束处理"""
        if exit_code == 0:
            self.log_text.append("\n检查完成，PyInstaller已安装")
        else:
            self.log_text.append("\n检查失败，PyInstaller未安装或Python解释器路径错误")
            self.log_text.append(f'可以点击"安装PyInstaller"按钮进行安装，或手动安装: "{self.get_interpreter_path()}" -m pip install pyinstaller')
    
    def package_scripts(self):
        """打包选中的Python脚本"""
        # 检查是否已经在打包中，防止重复运行
        if self.is_packaging:
            QMessageBox.information(self, "提示", "打包进程已在运行中")
            return
            
        interpreter_path = self.get_interpreter_path()
        if not interpreter_path:
            QMessageBox.warning(self, "错误", "请先选择Python解释器路径")
            return
        
        if not os.path.exists(interpreter_path):
            QMessageBox.warning(self, "错误", "Python解释器路径不存在")
            return
        
        if len(self.script_widgets) == 0:
            QMessageBox.warning(self, "错误", "请添加至少一个Python脚本")
            return
        
        # 获取打包选项
        self.package_options = {
            'one_file': self.one_file_cb.isChecked(),
            'console': self.console_cb.isChecked(),
            'name': self.name_input.text().strip(),
            'output_dir': self.output_dir.text().strip(),
            'clean': self.clean_cb.isChecked(),
            'icon_path': self.icon_path.text().strip(),
            'extra_data': self.extra_data.toPlainText().strip(),  # 使用toPlainText()获取多行文本
            'extra_args': self.extra_args.toPlainText().strip(),  # 使用toPlainText()获取多行文本
            'build_dir': self.build_dir.text().strip(),
            'spec_dir': self.spec_dir.text().strip(),
        }
        
        # 确保目录存在（使用 exist_ok=True 避免已存在错误）
        for dir_path in [self.package_options['output_dir'], 
                        self.package_options['build_dir'], 
                        self.package_options['spec_dir']]:
            if dir_path:
                try:
                    # 规范化路径并创建所有必要的父目录
                    normalized_path = os.path.normpath(os.path.abspath(dir_path))
                    os.makedirs(normalized_path, exist_ok=True)
                    self.log_text.append(f"确保目录存在: {normalized_path}")
                except OSError as e:
                    self.log_text.append(f"警告: 无法创建目录 {dir_path}: {str(e)}")
        
        # 设置打包范围
        self.package_all = self.all_scripts_rb.isChecked()
        
        # 准备要打包的脚本列表
        all_scripts = [w.script_path for w in self.script_widgets if os.path.exists(w.script_path)]
        if not all_scripts:
            QMessageBox.warning(self, "错误", "没有有效的Python脚本可打包")
            return
            
        # 设置打包状态为True
        self.is_packaging = True
        
        # 隐藏打包按钮，显示终止按钮
        self.package_btn.hide()
        self.stop_btn.show()
        
        # 根据选项过滤脚本
        if self.package_all:
            # 打包所有脚本
            self.scripts_to_package = all_scripts
            self.log_text.append(f"打包模式: 打包所有脚本 (共 {len(self.scripts_to_package)} 个)")
        else:
            # 仅打包main.py，不存在则打包第一个
            main_script = None
            for script in all_scripts:
                if os.path.basename(script).lower() == 'main.py':
                    main_script = script
                    break
            
            if main_script:
                self.scripts_to_package = [main_script]
                self.log_text.append(f"打包模式: 找到 main.py，仅打包该脚本")
                self.log_text.append(f"  脚本路径: {main_script}")
            else:
                self.scripts_to_package = [all_scripts[0]]
                self.log_text.append(f"打包模式: 未找到 main.py，打包第一个脚本")
                self.log_text.append(f"  脚本路径: {all_scripts[0]}")
        
        # 不自动跳转到日志标签页，让用户自行查看
        # 打包开始时显示绿色高亮
        self.log_needs_attention = True
        self.highlight_log_tab(True, color='green')
        
        # 开始打包第一个脚本
        self.current_script_index = 0
        self.package_next_script()
    
    def package_next_script(self):
        """打包下一个脚本"""
        if self.current_script_index >= len(self.scripts_to_package):
            # 所有脚本打包完成
            self.log_text.append("\n所有脚本打包完成！")
            # 取消日志标签页高亮
            self.highlight_log_tab(False)
            return
            
        script_path = self.scripts_to_package[self.current_script_index]
        script_name = os.path.basename(script_path)
        script_basename = os.path.splitext(script_name)[0]
        
        # 构建PyInstaller命令参数
        pyinstaller_args = []
        
        if self.package_options['one_file']:
            pyinstaller_args.append("--onefile")
        
        if not self.package_options['console']:
            pyinstaller_args.append("--noconsole")
        
        # 如果指定了名称则使用，否则使用脚本文件名
        name = self.package_options['name'] if self.package_options['name'] else script_basename
        pyinstaller_args.append(f"--name={name}")
        
        if self.package_options['output_dir']:
            pyinstaller_args.append(f"--distpath={self.package_options['output_dir']}")
        
        # 添加构建目录和spec文件目录参数
        if self.package_options['build_dir']:
            pyinstaller_args.append(f"--workpath={self.package_options['build_dir']}")
        
        if self.package_options['spec_dir']:
            pyinstaller_args.append(f"--specpath={self.package_options['spec_dir']}")
        
        if self.package_options['clean']:
            pyinstaller_args.append("--clean")
        
        if self.package_options['icon_path']:
            pyinstaller_args.append(f"--icon={self.package_options['icon_path']}")
        
        if self.package_options['extra_data']:
            # 处理多行 --add-data 参数，将每行作为独立参数添加
            for data_arg in self.package_options['extra_data'].split():
                pyinstaller_args.append(data_arg)
        
        # 添加二进制文件参数
        for binary_widget in self.binary_widgets:
            source = binary_widget.source_path
            dest = binary_widget.dest_path or "."
            # Windows使用分号，Linux/Mac使用冒号
            separator = ";" if sys.platform == "win32" else ":"
            binary_arg = f'--add-binary="{source}{separator}{dest}"'
            pyinstaller_args.append(binary_arg)
        
        if self.package_options['extra_args']:
            pyinstaller_args.extend(self.package_options['extra_args'].split())
        
        # 添加脚本路径
        pyinstaller_args.append(script_path)
        
        # 构建完整命令
        cmd = f'"{self.get_interpreter_path()}" -m PyInstaller {" ".join(pyinstaller_args)}'
        
        # 清空或添加分隔符到日志
        if self.current_script_index == 0:
            self.log_text.clear()
        else:
            self.log_text.append("\n" + "="*50 + "\n")
            
        self.log_text.append(f"开始打包 ({self.current_script_index + 1}/{len(self.scripts_to_package)}): {script_name}")
        self.log_text.append(f"执行命令: {cmd}")
        
        # 启动打包进程
        self.process = QProcess()
        self.process.readyReadStandardOutput.connect(self.process_output)
        self.process.readyReadStandardError.connect(self.process_error)
        self.process.finished.connect(self.on_package_finished)
        
        # 设置日志标签为绿色（进行中）
        self.highlight_log_tab(True, color='green')
        
        self.process.start(cmd)
    
    def highlight_log_tab(self, active=True, color='blue'):
        """高亮或取消高亮日志标签页
        
        Args:
            active: 是否激活高亮
            color: 高亮颜色，'green'表示进行中，'blue'表示完成
        """
        if active:
            # 设置标签文本并带圆点标记
            self.tabs.setTabText(self.log_tab_index, "● 打包日志")
            # 根据颜色参数设置不同的颜色
            if color == 'green':
                self.tabs.tabBar().setTabTextColor(self.log_tab_index, Qt.green)
            else:  # 默认蓝色
                self.tabs.tabBar().setTabTextColor(self.log_tab_index, Qt.blue)
        else:
            # 恢复标签文本
            self.tabs.setTabText(self.log_tab_index, "打包日志")
            self.tabs.tabBar().setTabTextColor(self.log_tab_index, Qt.black)
    
    def on_package_finished(self, exit_code, exit_status):
        """单个脚本打包完成后的处理"""
        script_path = self.scripts_to_package[self.current_script_index]
        script_name = os.path.basename(script_path)
        
        if exit_code == 0:
            self.log_text.append(f"\n{script_name} 打包成功！")
        else:
            self.log_text.append(f"\n{script_name} 打包失败，请检查错误信息")
        
        # 增加索引，准备打包下一个脚本
        self.current_script_index += 1
        
        # 如果是打包所有脚本模式且还有脚本未打包，则继续打包下一个
        if self.package_all and self.current_script_index < len(self.scripts_to_package):
            self.package_next_script()
        else:
            if self.current_script_index >= len(self.scripts_to_package):
                self.log_text.append("\n所有打包任务已完成！")
                
                # 添加打开输出目录按钮
                if self.package_options.get('output_dir') and os.path.exists(self.package_options['output_dir']):
                    self.add_open_output_dir_button()
            elif not self.package_all:
                # 单脚本模式只打包第一个
                self.log_text.append("\n打包任务已完成！")
                
                # 添加打开输出目录按钮
                if self.package_options.get('output_dir') and os.path.exists(self.package_options['output_dir']):
                    self.add_open_output_dir_button()
            
            # 打包完成后高亮日志标签页（蓝色），提醒用户查看
            self.log_needs_attention = True
            self.is_packaging = False  # 设置打包状态为False
            self.highlight_log_tab(True, color='blue')
            
            # 恢复按钮状态
            self.stop_btn.hide()
            self.package_btn.show()
    
    def add_open_output_dir_button(self):
        """添加打开输出目录按钮"""
        # 创建一个水平布局，放在日志标签页下方
        log_tab = self.tabs.widget(self.log_tab_index)
        log_layout = log_tab.layout()
        
        # 检查是否已经添加了按钮
        for i in range(log_layout.count()):
            widget = log_layout.itemAt(i).widget()
            if isinstance(widget, QPushButton) and widget.text() == "打开输出目录":
                return  # 已经有按钮了，不再添加
        
        # 创建按钮
        open_dir_btn = QPushButton("打开输出目录")
        open_dir_btn.clicked.connect(self.open_output_directory)
        log_layout.addWidget(open_dir_btn)
    
    def open_output_directory(self):
        """打开输出目录"""
        output_dir = self.package_options.get('output_dir')
        if output_dir and os.path.exists(output_dir):
            # 使用系统默认文件浏览器打开目录
            if sys.platform == 'win32':
                os.startfile(output_dir)
            elif sys.platform == 'darwin':  # macOS
                subprocess.call(['open', output_dir])
            else:  # Linux
                subprocess.call(['xdg-open', output_dir])


def main():
    app = QApplication(sys.argv)
    
    # 设置应用样式
    app.setStyle("Fusion")
    
    packager = PythonPackager()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main() 