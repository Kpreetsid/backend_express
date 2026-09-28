#!/usr/bin/env python3
import json,subprocess,time

def run(cmd,timeout=60):
    p=subprocess.run(cmd,text=True,capture_output=True,timeout=timeout)
    return p

p=run(['aws','sts','get-caller-identity','--output','json'])
if p.returncode!=0:
    print('OIDC_IDENTITY_ERROR\t'+(p.stderr or p.stdout or '')[:1000])
    raise SystemExit(p.returncode)
ident=json.loads(p.stdout)
print('OIDC_IDENTITY\t'+json.dumps({'Account':ident.get('Account'),'Arn':ident.get('Arn'),'UserId':ident.get('UserId')},separators=(',',':')))
if ident.get('Account')!='059361097726':
    raise SystemExit(9)

p=run(['aws','bedrock','list-foundation-models','--region','ap-south-1','--output','json'])
if p.returncode!=0:
    print('BEDROCK_LIST_ERROR\t'+(p.stderr or p.stdout or '')[:1000])
    raise SystemExit(p.returncode)
data=json.loads(p.stdout)
models=[]
for m in data.get('modelSummaries',[]):
    s=' '.join(str(m.get(k,'')) for k in ('providerName','modelName','modelId'))
    if 'qwen' in s.lower():
        models.append({
            'modelId':m.get('modelId'),
            'modelName':m.get('modelName'),
            'providerName':m.get('providerName'),
            'inferenceTypesSupported':m.get('inferenceTypesSupported'),
            'responseStreamingSupported':m.get('responseStreamingSupported'),
        })
print('QWEN_MODELS\t'+json.dumps(models,separators=(',',':')))
if not models:
    raise SystemExit(10)

targets=['qwen.qwen3-32b-v1:0','qwen.qwen3-next-80b-a3b']
messages=[{'role':'user','content':[{'text':'Overall temperature is 26.8 degrees C. Call the assert_field tool exactly once.'}]}]
tool_config={'tools':[{'toolSpec':{
    'name':'assert_field',
    'description':'Record a current asserted field value.',
    'inputSchema':{'json':{
        'type':'object',
        'additionalProperties':False,
        'properties':{
            'field':{'type':'string','enum':['overallTemperature']},
            'value':{'type':'number'},
            'evidenceQuote':{'type':'string'},
        },
        'required':['field','value','evidenceQuote'],
    }},
}}],'toolChoice':{'any':{}}}
inference={'maxTokens':160,'temperature':0}
rows=[]
for model in targets:
    cmd=[
        'aws','bedrock-runtime','converse',
        '--region','ap-south-1',
        '--model-id',model,
        '--messages',json.dumps(messages,separators=(',',':')),
        '--tool-config',json.dumps(tool_config,separators=(',',':')),
        '--inference-config',json.dumps(inference,separators=(',',':')),
        '--output','json',
    ]
    started=time.time()
    p=run(cmd,timeout=90)
    row={'model':model,'elapsedMs':round((time.time()-started)*1000),'exitCode':p.returncode}
    if p.returncode!=0:
        row['pass']=False
        row['error']=(p.stderr or p.stdout or '')[:1000]
        rows.append(row)
        print('QWEN_CONVERSE\t'+json.dumps(row,separators=(',',':')))
        continue
    d=json.loads(p.stdout)
    content=((d.get('output') or {}).get('message') or {}).get('content') or []
    calls=[x.get('toolUse') for x in content if isinstance(x,dict) and isinstance(x.get('toolUse'),dict)]
    args=(calls[0] or {}).get('input') if len(calls)==1 else {}
    ok=(len(calls)==1
        and (calls[0] or {}).get('name')=='assert_field'
        and isinstance(args,dict)
        and args.get('field')=='overallTemperature'
        and abs(float(args.get('value'))-26.8)<1e-9
        and isinstance(args.get('evidenceQuote'),str)
        and '26.8' in args.get('evidenceQuote'))
    row.update({
        'pass':bool(ok),
        'toolCallCount':len(calls),
        'stopReason':d.get('stopReason'),
        'usage':d.get('usage'),
        'metrics':d.get('metrics'),
    })
    rows.append(row)
    print('QWEN_CONVERSE\t'+json.dumps(row,separators=(',',':')))
print('QWEN_CONVERSE_SUMMARY\t'+json.dumps({'total':len(rows),'pass':sum(1 for r in rows if r.get('pass'))},separators=(',',':')))
if not all(r.get('pass') for r in rows):
    raise SystemExit(7)
