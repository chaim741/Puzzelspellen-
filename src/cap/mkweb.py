import sys,shutil,os,re
src,dst=sys.argv[1],sys.argv[2]
h=open(src).read()
h=re.sub(r'<link rel="preconnect"[^>]*>\n','',h)
h=re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^>]*>','<link rel="stylesheet" href="fonts.css">',h)
h=h.replace('<meta name="claude:viewport-fit-sides" content="cover">\n','')
doc='<!doctype html>\n<html lang="nl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">\n'
i=h.index('</style>')+len('</style>')
doc+=h[:i]+'\n</head>\n<body>\n'+h[i:]+'\n</body>\n</html>\n'
os.makedirs(dst+'/fonts',exist_ok=True)
open(dst+'/index.html','w').write(doc)
fd='../fonts2'
for f in os.listdir(fd):
    if f.endswith('.woff2'): shutil.copy(fd+'/'+f,dst+'/fonts/'+f)
shutil.copy(fd+'/local.css',dst+'/fonts.css')
