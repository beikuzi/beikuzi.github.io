官网下安装包，选中这个添加到路径，然后一键或者自定义安装都行

![](./images/快速写python/media/image1.png)

如果有正确添加路径，那么在cmd里where pip就会正常显示位置

![](./images/快速写python/media/image2.png)

在cursor中需要选择python解释器，上一步有在环境变量里，cursor就会自动识别位置

![](./images/快速写python/media/image3.png)

接下来使用这三个脚本+ai就无基础完成一些python项目的开发了

![](./images/快速写python/media/image4.png)\
\
首先是创建虚拟环境，好处如下：

指这个环境只会在这一个项目被使用，因为不同的项目可能需要的环境依赖版本不一样，在系统通用里安装依赖可能会出现冲突。可以用docker容器的思想去理解

而且一旦出现问题直接删除虚拟环境再重新生成也非常方便

立刻将当前目录也添加到了python临时路径下，不会出现文件import索引不到等奇奇怪怪的问题

（ai补充剩余部分）

这个步骤也可以使用python脚本去实现，我已经用ai写好了脚本，直接执行0_venv.py即可

他会自动下载一个依赖，下载完后会自动创建虚拟环境.venv\
![](./images/快速写python/media/image5.png)![](./images/快速写python/media/image6.png)

如果是cursor，那么直接使用这个就可以立刻切换到虚拟环境\
![](./images/快速写python/media/image7.png)\
\
如果没有选到，那么也可以通过按下ctrl+shift+p ，用python
的选择解释器进行切换\
![](./images/快速写python/media/image8.png)

这样基本的环境就准备好了，然后就可以写python代码。一般可以直接将需求丢给ai，ai会帮你生成代码然后会附带需要安装的依赖列表
requestments.txt，如果去拉取github仓库等一般也会携带。\
\
不过，如果是ai写代码，可能会存在各种奇奇怪怪的情况，以及中途修改的时候可能会忘记添加到requestments中去，导致依赖不全\
使用1_requestments.py，他会立刻扫描目录下所有的python文件，找出需要安装的目录（当然，排除了一些目录，比如.venv里的，以及提供了一些import实际上在pip中安装名字的对应映射）

（如果只希望扫描某个目录可以修改myenv.json填import_src，不填默认全部扫描）

ai写代码增加头文件时，有可能会再次使用该脚本

![](./images/快速写python/media/image9.png)

扫描结果如下

![](./images/快速写python/media/image10.png)

生成出来后需要安装依赖，虽然可以逐个安装或者操作requestments.txt，但安装也可以由py脚本直接完成。执行2_install_import.py

里面默认设置了安装源是清华源来解决国内下载慢问题，需要修改同样也可以到myenv.json

![](./images/快速写python/media/image11.png)

执行的效果是这样子的

![](./images/快速写python/media/image12.png)

然后一切完成，点运行就可以启动了

![](./images/快速写python/media/image13.png)

写python的过程就非常简单了：跟ai对话写程序，如果运行不了问ai，缺依赖执行脚本1_requirements.py再执行2_install_import.py即可。

其他

有些情况可能没有办法安装python，可以搜索嵌入式python来使用。但嵌入式python可能默认不携带pip，可以自行找一个pip放在python目录下

此外，有一些需要pytorch的项目，可能支持的python版本没有那么高（例如在3.8\~3.12），使用高版本python可能会导致安装失败
