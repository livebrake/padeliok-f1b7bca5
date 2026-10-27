"""Live team authorization regression checks. Uses server-only environment credentials.
Run with python3 src/test/team-access.integration.py. Creates and deletes its own test account.
"""
import os, json, secrets, asyncio
from pathlib import Path
import requests
from playwright.async_api import async_playwright

base = os.environ['SUPABASE_URL'].rstrip('/')
key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
admin_headers = {'apikey': key, 'Content-Type': 'application/json'}
if not key.startswith('sb_'):
    admin_headers['Authorization'] = 'Bearer ' + key

def call(method, path, headers, data=None):
    return requests.request(method, base+path, headers=headers, json=data, timeout=20)

async def verify():
    password=secrets.token_urlsafe(24)
    email='team-check-'+secrets.token_hex(6)+'@example.com'
    created=call('POST','/auth/v1/admin/users',admin_headers,{'email':email,'password':password,'email_confirm':True,'user_metadata':{'full_name':'Patikros Darbuotojas'}})
    assert created.ok, 'Test account creation failed'
    uid=created.json()['id']
    try:
        for table,payload in [('team_members',{'user_id':uid,'name':'Patikros Darbuotojas','email':email}),('team_roles',{'user_id':uid,'role':'employee'})]:
            assert call('POST','/rest/v1/'+table,admin_headers,payload).ok, 'Test membership creation failed'
        auth=call('POST','/auth/v1/token?grant_type=password',admin_headers,{'email':email,'password':password})
        assert auth.ok, 'Employee sign in failed'
        user_headers={'apikey':key,'Authorization':'Bearer '+auth.json()['access_token'],'Content-Type':'application/json'}
        # Use the publishable key for RLS requests, never the privileged apikey.
        user_headers['apikey']=os.environ['SUPABASE_PUBLISHABLE_KEY']
        rows=call('POST','/rest/v1/rpc/team_orders',user_headers,{}).json()
        assert isinstance(rows,list) and rows, 'Employee orders unavailable'
        assert all('price' not in row for row in rows), 'Financial values leaked'
        assert not call('GET','/rest/v1/orders?select=price',user_headers).ok, 'Direct financial read allowed'
        order=rows[0]
        assert not call('PATCH','/rest/v1/orders?id=eq.'+order['id'],user_headers,{'payment_status':'PAID'}).ok, 'Employee changed payment state'
        assert not call('POST','/rest/v1/rpc/change_team_order',user_headers,{'order_uuid':order['id'],'work_status':'Apmokėta'}).ok, 'Payment state accepted as work state'
        assert not call('POST','/rest/v1/rpc/manage_team_member',user_headers,{'target_user':uid,'display_name':'Unauthorized','member_email':email,'new_role':'super_admin','active':True}).ok, 'Employee escalated role'
        async with async_playwright() as p:
            browser=await p.chromium.launch(headless=True)
            context=await browser.new_context(viewport={'width':1280,'height':1800})
            page=await context.new_page()
            await page.goto('http://localhost:8080/misko-skydas/jungtis')
            await page.get_by_label('El. paštas',exact=True).fill(email)
            await page.get_by_label('Slaptažodis',exact=True).fill(password)
            await page.get_by_role('button',name='Prisijungti',exact=True).click()
            await page.get_by_role('tab',name='Užsakymai',exact=True).wait_for()
            for tab in ['Komanda','Finansai','Nustatymai']:
                assert await page.get_by_role('tab',name=tab,exact=True).count()==0, 'Restricted navigation visible'
            nr=order['order_number']
            await page.get_by_role('button',name='Būsena: '+nr,exact=True).click()
            target='Naujas' if order['status']=='Vykdoma' else 'Vykdoma'
            await page.get_by_role('menuitem',name=target,exact=True).click()
            await page.get_by_text('Būsena pakeista į',exact=False).wait_for()
            await page.get_by_role('button',name='#'+nr,exact=True).click()
            dialog=page.get_by_role('dialog')
            await dialog.get_by_label('Pridėti pastabą').fill('Patikrinimas: darbuotojo teisės ir istorija.')
            await dialog.get_by_role('button',name='Išsaugoti',exact=True).click()
            await dialog.get_by_text('Patikrinimas: darbuotojo teisės ir istorija.',exact=True).wait_for()
            await dialog.screenshot(path='/tmp/browser/team/employee-details.png')
            logs=call('GET','/rest/v1/order_audit_logs?actor_id=eq.'+uid,user_headers).json()
            assert any(x['action_type']=='STATUS_CHANGE' for x in logs), 'Employee status not audited'
            assert any(x['action_type']=='NOTE' and x['actor_name']=='Patikros Darbuotojas' for x in logs), 'Employee note attribution wrong'
            if order['status'] in ['Naujas','Vykdoma','Atlikta','Atšaukta']:
                assert call('POST','/rest/v1/rpc/change_team_order',user_headers,{'order_uuid':order['id'],'work_status':order['status']}).ok
            assert call('PATCH','/rest/v1/team_members?user_id=eq.'+uid,admin_headers,{'is_active':False}).ok
            assert not call('POST','/rest/v1/rpc/team_orders',user_headers,{}).ok, 'Deactivated employee kept access'
            print('PASS employee login, order mutation and note readback; financial/payment/team escalation denied; deactivation enforced')
            await browser.close()
        with open(os.path.expanduser('~/.cache/lovable-auth/session.json')) as f: supervisor=json.load(f)['session']
        supervisor_headers={**user_headers,'Authorization':'Bearer '+supervisor['access_token']}
        current=call('GET','/rest/v1/team_members?user_id=eq.'+supervisor['user']['id'],supervisor_headers).json()[0]
        result=call('POST','/rest/v1/rpc/manage_team_member',supervisor_headers,{'target_user':current['user_id'],'display_name':current['name'],'member_email':current['email'],'new_role':'employee','active':True})
        assert not result.ok and 'paskutinio' in result.text, 'Last supervisor removal allowed'
        print('PASS last-super-admin protection')
    finally:
        # Only remove isolated test account data; preserve its immutable audit entries.
        call('DELETE','/rest/v1/team_roles?user_id=eq.'+uid,admin_headers)
        call('DELETE','/rest/v1/team_members?user_id=eq.'+uid,admin_headers)
        call('DELETE','/auth/v1/admin/users/'+uid,admin_headers)

if __name__=='__main__':
    Path('/tmp/browser/team').mkdir(parents=True,exist_ok=True)
    asyncio.run(verify())