window.manufacturing_periperal_inner_template = `
<div class="item-content" lastDiscoverDate="{{lastDiscoverDate}}" rssi="{{rssi}}" model="{{model}}">
	<div class="item-inner">
		<div class="item-title-row">
		    <div class="item-title" lang="en">{{model}}-{{name}}</div>
		</div>
		<div class="item-subtitle">{{id}}, RSSI: {{rssi}}</div>
	</div>
	<a class="button button-raised" func="manufacturing_start_produce" ref="{{id}}" style="float:right;line-height:50px;width:80px;padding:0px;margin-right:10px;background-color:#fff;">生產</a>
</div>
`;
window.manufacturing_periperal_outer_template = `
<li class="manufacturing-peripheral device" uuid="{{id}}" style="max-height:70px;padding:10px 5px;">
    ${manufacturing_periperal_inner_template}
</li>
`;

window.manufacturing_periperals = {};
window.manufacturing_scan_timer = null;
window.manufacturing_new_guid = "";
window.controller_toggle_manufacturing = function(params){
    let batch = $("select[name='manufacturing-batch']").val();
    let model = $("select[name='manufacturing-model']").val();
    
    let error = "";
    if(batch==""){
        error = "请选择批次";
    }
    if(model==""){
        error = error=="" ? "请选择型号" : "请选择批次和型号";
    }
    if(error!=""){
        app.dialog.alert(error);
        return;
    }

    if(params.obj.text()=="开始"){
        params.obj.html("停止");
        $(".button.back").hide();
        $("select[name='manufacturing-batch']").prop('disabled',true);
        $("select[name='manufacturing-model']").prop('disabled',true);
        
        ble.stopScan(function(){
            manufacturing_scan_timer = setInterval(function(){
                let now = new Date();
                now.setSeconds(now.getSeconds() - 10);
                $(".manufacturing-peripheral").each(function(){
                    let ld = new Date($(this).find('.item-content').attr('lastDiscoverDate'));
                    // console.log("guid ld="+ld.getTime());
                    // console.log("guid now="+now.getTime());
                    if(ld.getTime() < now.getTime()){
                        $(this).remove()
                    }
                });
            }, 5000);
            is_ble_scanning = true;
            ble.startScanWithOptions(["fff0","ff70","ffB0","ff80"],
                { reportDuplicates: true, scanMode:"lowLatency" }, function(peripheral) {
                manufacturing_did_found(peripheral);
            }, function(){
                l("Manufacturing", "[Need check] Start BLE scan fail");
            });
        }, function(){
        });
    }else{
        params.obj.html("开始");
        $(".button.back").show();
        $("select[name='manufacturing-batch']").prop('disabled',false);
        $("select[name='manufacturing-model']").prop('disabled',false);
        $('.manufacturing-peripheral').remove();
        
        clearInterval(manufacturing_scan_timer);
        ble.stopScan(function(){
        }, function(){
        });
    }
};

let newRssiList = [];

window.manufacturing_did_found = (peripheral) => {
    if(!$('input[name="checkbox-manufacturing-show-done"]').is(':checked')){
        let pmodel = (isset(ble_model[peripheral.hexModel.toLowerCase()])) ? ble_model[peripheral.hexModel.toLowerCase()].name : 'BG000';
        if(pmodel.toLowerCase()!='bg000'){
            return;
        }
    }
    if(!$('input[name="checkbox-manufacturing-show-all"]').is(':checked')){
        if(peripheral.rssi < -60){
            return;
        }
    }
    
    if(!isset(peripheral.id)) return;
    
    if(isset(manufacturing_periperals[peripheral.id])){
        manufacturing_periperals[peripheral.id] = app.utils.extend(manufacturing_periperals[peripheral.id], peripheral);
    }else{
        manufacturing_periperals[peripheral.id] = peripheral;
        console.log(JSON.stringify(peripheral));
    }
    const updateRssi = (newElement)=>{
        let this_status = false;
        if (newRssiList.length < 3) {
            newRssiList.push(newElement);
            this_status = true;
        } else {
            const minElement = Math.min(...newRssiList);
            if (newElement > minElement) {
                const minIndex = newRssiList.indexOf(minElement);
                newRssiList[minIndex] = newElement;
                this_status = true;
            }
        }
        return this_status;
    }
    let args = {}
    args.id = peripheral.id;
    args.name = peripheral.name;
    args.guid = peripheral.guid;
    args.rssi = peripheral.rssi;
    args.lastDiscoverDate = peripheral.lastDiscoverDate;
    args.model = (isset(ble_model[peripheral.hexModel.toLowerCase()])) ? ble_model[peripheral.hexModel.toLowerCase()].name : 'BG000'
    // if(!updateRssi(peripheral.rssi)){
    //     return
    // }
    // return
    let innerHtml = jinja2.render(manufacturing_periperal_inner_template, args);
    let outerHtml = jinja2.render(manufacturing_periperal_outer_template, args);
    if(isset($('.manufacturing-peripheral[uuid="'+peripheral.id+'"]').attr('uuid'))){
        $('.manufacturing-peripheral[uuid="'+peripheral.id+'"]').html(innerHtml);
    }else{
        $('.manufacturing-found-list ul').append(outerHtml);
    }
};

window.manufacturing_processing = false;
window.manufacturing_current_step = 0;
window.manufacturing_produce_timer = null;
window.manufacturing_password = '000000';
window.manufacturing_default_password = '000000';
window.manufacturing_start_produce = (params) => {
    // Icons
    // 	<i class="icon material-icons" style="font-weight:bold;color:green">done</i>
    // 	<i class="icon material-icons">watch_later</i>
    // 	<i class="icon material-icons spin_icon">autorenew</i>
    
    if($('.manufacturing-btn-start').html()=='开始'){
        app.dialog.alert('请先设定好批次及型号，并按开始后再进行生产！');
        return;
    }
    
    manufacturing_current_step = 0;
    app.sheet.create({
        content: `
            <div class="sheet-modal" style="height:auto">
            	<div class="sheet-modal-inner">
            		<div class="swipe-handler"></div>
            		<div class="page-content">
            			<div class="list list-strong list-outline list-dividers-ios">
            				<ul>
            					<li class="manufacturing-steps manufacturing-step1">
            						<div class="item-content">
            							<div class="item-inner">
            								<div class="item-title">步驟1：連接設備</div>
            								<div class="item-after">
            									<i class="icon material-icons">watch_later</i>
            								</div>
            							</div>
            						</div>
            					</li>
            					<li class="manufacturing-steps manufacturing-step2">
            						<div class="item-content">
            							<div class="item-inner">
            								<div class="item-title">步驟2：讀取Mac</div>
            								<div class="item-after">
            									<i class="icon material-icons">watch_later</i>
            								</div>
            							</div>
            						</div>
            					</li>
            					<li class="manufacturing-steps manufacturing-step3">
            						<div class="item-content">
            							<div class="item-inner">
            								<div class="item-title">步驟3：讀取版本號</div>
            								<div class="item-after">
            									<i class="icon material-icons">watch_later</i>
            								</div>
            							</div>
            						</div>
            					</li>
            					<li class="manufacturing-steps manufacturing-step4">
            						<div class="item-content">
            							<div class="item-inner">
            								<div class="item-title">步驟4：輸入密匙</div>
            								<div class="item-after">
            									<i class="icon material-icons">watch_later</i>
            								</div>
            							</div>
            						</div>
            					</li>
            					<li class="manufacturing-steps manufacturing-step5">
            						<div class="item-content">
            							<div class="item-inner">
            								<div class="item-title">步驟5：更新設置名稱及設定</div>
            								<div class="item-after">
            									<i class="icon material-icons">watch_later</i>
            								</div>
            							</div>
            						</div>
            					</li>
            					<li class="manufacturing-steps manufacturing-step6">
            						<div class="item-content">
            							<div class="item-inner">
            								<div class="item-title">步驟6：重啟中</div>
            								<div class="item-after">
            									<i class="icon material-icons">watch_later</i>
            								</div>
            							</div>
            						</div>
            					</li>
            					<li class="manufacturing-steps manufacturing-step7">
            						<div class="item-content">
            							<div class="item-inner">
            								<div class="item-title">步驟7：確認更新設置名稱</div>
            								<div class="item-after">
            									<i class="icon material-icons">watch_later</i>
            								</div>
            							</div>
            						</div>
            					</li>
            					<li class="manufacturing-steps manufacturing-step8">
            						<div class="item-content">
            							<div class="item-inner">
            								<div class="item-title">步驟8：上傳my.mob-mob.com伺服器</div>
            								<div class="item-after">
            									<i class="icon material-icons">watch_later</i>
            								</div>
            							</div>
            						</div>
            					</li>
            					<li class="manufacturing-steps manufacturing-step9">
            						<div class="item-content">
            							<div class="item-inner">
            								<div class="item-title">步驟9：上傳erp伺服器</div>
            								<div class="item-after">
            									<i class="icon material-icons">watch_later</i>
            								</div>
            							</div>
            						</div>
            					</li>
            				</ul>
            			</div>
            			<div class="block manufacturing-remaining-time" style="text-align:center;">
            				生產剩餘時間: <font>30</font>秒
            			</div>
            		</div>
            	</div>
            </div>
        `,
        on: {
            closed: function () {
                clearTimeout(manufacturing_produce_timer);
                if(manufacturing_processing){
                    app.dialog.alert("生產中斷，請重新生產！", runtime.appInfo.name);
                }
                manufacturing_processing = false;
            }
        },
        swipeToClose: true,
        push: true,
        backdrop: true,
    }).open();


    let args = {},
        p = manufacturing_periperals[params.ref],
        id = p.id,
        batch = $("select[name='manufacturing-batch']").val(),
        model = $("select[name='manufacturing-model']").val(),
        batchText = $("select[name='manufacturing-batch'] option[value='" + batch + "']").text(),
        modelText = $("select[name='manufacturing-model'] option[value='" + model + "']").text();
	
    manufacturing_password = '000000';
    manufacturing_default_password = '000000';
    
	let cmd = [];
	// connect
	cmd.push({action:"connect", pre:"manufacturing_update_step", post:"manufacturing_update_step"});
	// read mac address 2a23
	cmd.push({action:"read",serv:'180a',char:'2a23', pre:"manufacturing_update_step", post:"manufacturing_update_step"});
	// read firmware version 2a26
	cmd.push({action:"read",serv:'180a',char:'2a26', pre:"manufacturing_update_step", post:"manufacturing_update_step"});
	// write serial number 
    cmd.push({action:"write",data:('88014B{{macs[3]}}{{macs[0]}}A16E95').toLowerCase(), pre:"manufacturing_update_step"}); 
	// write super password 
    cmd.push({action:"write",data:('880083{{macs[2]}}{{macs[5]}}543e15').toLowerCase()}); 
	// write flash led
	cmd.push({action:"write",data:('812c01').toLowerCase(), post:"manufacturing_update_step"}); 
	// write new name
    cmd.push({action:"write",data:('8100{{machexs[0]}}{{machexs[1]}}{{machexs[2]}}{{machexs[3]}}{{machexs[4]}}{{machexs[5]}}12' + model + batch).toLowerCase(), pre:"manufacturing_update_step"});  // device name 
    manufacturing_new_guid = '{{machexs[0]}}{{machexs[1]}}{{machexs[2]}}{{machexs[3]}}{{machexs[4]}}{{machexs[5]}}12' + model + batch;
    
    
    /* default config of model and batch */
    if(isset(ble_model[p.hexModel]) && isset(ble_model[p.hexModel]['default']) && ble_model[p.hexModel]['default'].length){
        for(let k in ble_model[p.hexModel]['default']){
            cmd.push({action:"write",data:ble_model[p.hexModel]['default'][k].toLowerCase()});
            
            console.log(k);
            console.log(ble_model[p.hexModel]['default'][k]);
            if(ble_model[p.hexModel]['default'][k].startsWith('82')){
                manufacturing_password = ble_model[p.hexModel]['default'][k].substring(14).convertToAscii();
            }
            if(ble_model[p.hexModel]['default'][k].startsWith('88038354')){
                manufacturing_default_password = ble_model[p.hexModel]['default'][k].substring(8).convertToAscii();
            }
        }
    }
    if(isset(ble_batch[p.hexBatch]) && isset(ble_batch[p.hexBatch]['default']) && ble_batch[p.hexBatch]['default'].length){
        for(let k in ble_batch[p.hexBatch]['default']){
            cmd.push({action:"write",data:ble_batch[p.hexBatch]['default'][k].toLowerCase()});
            
            if(ble_batch[p.hexBatch]['default'][k].startsWith('82')){
                manufacturing_password = ble_batch[p.hexBatch]['default'][k].substring(14).convertToAscii();
            }
            if(ble_batch[p.hexBatch]['default'][k].startsWith('88038354')){
                manufacturing_default_password = ble_batch[p.hexBatch]['default'][k].substring(8).convertToAscii();
            }
        }
    }
    
    
	// read manufacturer 2a29
	cmd.push({action:"read",serv:'180a',char:'2a29'});
	// write resume led
	cmd.push({action:"write",data:('812c00').toLowerCase(), post:"manufacturing_update_step"}); 
    
// 	// read manufacturer 2a29
// 	cmd.push({action:"read",serv:'180a',char:'2a29', post:"manufacturing_update_step"});
// 	// write resume led
// 	cmd.push({action:"write",data:('812c00').toLowerCase(), pre:"manufacturing_update_step"}); 
// 	cmd.push({action:"write",data:('8000ff').toLowerCase()}); 
// 	cmd.push({action:"write",data:('8900ff').toLowerCase()}); 
// 	cmd.push({action:"delay",delay:3}); 
// 	cmd.push({action:"write",data:('800000').toLowerCase()}); 
// 	cmd.push({action:"write",data:('890000').toLowerCase()}); 
// 	cmd.push({action:"delay",delay:2, post:"manufacturing_update_step"}); 
	// write restart
	cmd.push({action:"write",data:("810e").toLowerCase(), pre:"manufacturing_update_step"}); 
	// end command, no need to write
	cmd.push({action:"connect", post:"manufacturing_update_step"});
	cmd.push({action:"read",serv:'180a',char:'2a29', pre:"manufacturing_update_step"});
	cmd.push({action:"disconnect"});
	cmd.push({action:"connect"});
	cmd.push({action:"read",serv:'180a',char:'2a29'});
	cmd.push({action:"disconnect", post:"manufacturing_update_step"});
	cmd.push({action:"other", post:"manufacturing_upload_to_my_mobmob"});
	cmd.push({action:"other", post:"manufacturing_upload_to_erp"});
	
    
    // app.preloader.show();
    manufacturing_processing = true;
    manufacturing_start_produce_timer(30);
    manufacturing_process_periperal(id, cmd);
};

window.manufacturing_start_produce_timer = (second) => {
    $('.manufacturing-remaining-time').find('font').html(second);
    if(second>0){
        manufacturing_produce_timer = setTimeout(function(){
            manufacturing_start_produce_timer(second-1);
        }, 1000);
    }else{
        if(manufacturing_processing){
            manufacturing_processing = false;
            $('.manufacturing-remaining-time').attr('style','text-align:center;color:red;');
            $('.manufacturing-remaining-time').html('生產失敗，請重新嘗試');
            $('.manufacturing-steps').each(function(){
                if($(this).hasClass('done')) return;
                
                $(this).find('.icon').removeClass('spin_icon').attr('style','font-weight:bold;color:red').html('close')
            });
        }
    }
}

window.manufacturing_process_periperal = (id, cmd) => {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    
    (function loop(i, repeat) {
        if (i >= cmd.length) return;
        if (!manufacturing_processing){
            return;
        }
        delay(100).then(() => {
            if(!isset(repeat) && isset(cmd[i].pre) && isset(window[cmd[i].pre])){
                window[cmd[i].pre](id, 'start', null);
            }
            if(cmd[i].action=="connect"){
                console.log("Manufacturing: Connect");
                manufacturing_periperals[id].reconnect = true;
                ble.connect(id, function(rs){
                    manufacturing_periperals[id].reconnect = false;
                    console.log("Manufacturing: Connect Successfully");
                    if(isset(cmd[i].post) && isset(window[cmd[i].post])){
                        window[cmd[i].post](id, 'done', null);
                    }
                    loop(i+1);
                }, function(rs){
                    if(manufacturing_periperals[id].reconnect){
                        console.log("Manufacturing: ReConnect");
                        loop(i, true);
                    }
                });
            }else if(cmd[i].action=="disconnect"){
                console.log("Manufacturing: Disonnect");
                ble.disconnect(id, function(rs){
                    console.log("Manufacturing: Disonnect Successfully");
                    if(isset(cmd[i].post) && isset(window[cmd[i].post])){
                        window[cmd[i].post](id, 'done', null);
                    }
                    loop(i+1);
                }, function(){
                    loop(i+1);
                });
            }else if(cmd[i].action=="write"){
                if(cmd[i].data=="810e"){
                    console.log("Manufacturing: Restart "+cmd[i].data);
                    ble.write(id, "ff80", "ff81", cmd[i].data.convertToBytes(), function(){
                        console.log("Manufacturing: Restart "+cmd[i].data+" Successfully.");
                        if(isset(cmd[i].post) && isset(window[cmd[i].post])){
                            window[cmd[i].post](id, 'done', null);
                        }
                        loop(i+1);
                    }, function(){
                        console.log("Manufacturing: Restart "+cmd[i].data+" Failed (Successfully).");
                        if(isset(cmd[i].post) && isset(window[cmd[i].post])){
                            window[cmd[i].post](id, 'done', null);
                        }
                        loop(i+1);
                    });
                }else{
                    console.log("Manufacturing: Write "+cmd[i].data);
                    ble.write(id, "ff80", "ff81", cmd[i].data.convertToBytes(), function(){
                        console.log("Manufacturing: Write "+cmd[i].data+" Successfully.");
                        if(isset(cmd[i].post) && isset(window[cmd[i].post])){
                            window[cmd[i].post](id, 'done', null);
                        }
                        loop(i+1);
                    }, function(){
                        loop(i, true);
                    });
                }
            }else if(cmd[i].action=="read"){
                console.log("Manufacturing: Read "+cmd[i].serv+" -> "+cmd[i].char);
                ble.read(id, cmd[i].serv, cmd[i].char, function(rs){
                    console.log("Manufacturing: Read "+cmd[i].serv+" -> "+cmd[i].char+" = "+rs+" Successfully");
                    if(cmd[i].char=="2a23"){//read macaddress
                        rs = ((rs.substring(0, 12).match(/.{1,2}/g)).reverse().join(":")).toUpperCase();
                        manufacturing_periperals[id].mac_address = rs;
                        
                        let macs = rs.split(":");
                        let machexs = rs.split(":");
                        for(let j in machexs){
                            machexs[j] = machexs[j].toLowerCase().convertToHex();
                        }
                        for(let j=0; j<cmd.length; j++){
                            if(isset(cmd[j].data)){
                                cmd[j].data = jinja2.render(cmd[j].data, {macs:macs,machexs:machexs});
                            }
                        }
                        manufacturing_new_guid = jinja2.render(manufacturing_new_guid, {macs:macs,machexs:machexs});
                        manufacturing_new_guid = manufacturing_new_guid.toLowerCase();
                    }else if(cmd[i].char=="2a26"){
                        rs = parseFloat(rs.substring(2).convertToAscii());
                        manufacturing_periperals[id].firmware = rs;
                    }else{
                        rs = null;
                    }
                    if(isset(cmd[i].post) && isset(window[cmd[i].post])){
                        window[cmd[i].post](id, 'done', rs);
                    }
                    loop(i+1);
                }, function(){
                    loop(i, true);
                });
            }else if(cmd[i].action=="delay"){
                setTimeout(function(){
                    if(isset(cmd[i].post) && isset(window[cmd[i].post])){
                        window[cmd[i].post](id, 'done', null);
                    }
                    loop(i+1);
                }, cmd[i].delay*1000);
            }else{
                if(isset(cmd[i].post) && isset(window[cmd[i].post])){
                    window[cmd[i].post](id, 'done', null).then(() => {
                        manufacturing_update_step(id, 'done', null);
                        loop(i+1);
                    });
                }else{
                    loop(i+1);
                }
            }
        });
    })(0);
};

window.manufacturing_update_step = (id, flag, info) => {
    if(flag=='start'){
        manufacturing_current_step++;
        $('.manufacturing-step'+manufacturing_current_step).find('.icon').addClass('spin_icon').html('autorenew')
    }else if(flag=='done'){
        $('.manufacturing-step'+manufacturing_current_step).addClass('done');
        $('.manufacturing-step'+manufacturing_current_step).find('.icon').removeClass('spin_icon').attr('style','font-weight:bold;color:green').html('done')
    }
    if(isset(info)){
        $('.manufacturing-step'+manufacturing_current_step).find('.item-title').append(": "+info);
    }
    if($('.manufacturing-steps').length == $('.manufacturing-steps.done').length){
        // app.preloader.hide();
        // $('.summary-icon').removeClass('spin_icon').attr('style','font-weight:bold;color:green;font-size:50px;').html('done')
        manufacturing_processing = false;
        clearTimeout(manufacturing_produce_timer);
        $('.manufacturing-remaining-time').attr('style','text-align:center;color:green;');
        $('.manufacturing-remaining-time').html('生產完成！');
    }
    console.log("Manufacturing: "+flag+" manufacturing-step"+manufacturing_current_step);
};

window.manufacturing_upload_to_my_mobmob = (id, args) => {
    manufacturing_update_step(id, 'start', null);

    if(!isset(manufacturing_periperals[id])) return;
    
    let p = manufacturing_periperals[id];
    let parameters = [];
    parameters.push('mac_address='+p.mac_address);
    parameters.push('uuid='+id);
    parameters.push('hex_model='+p.hexModel);
    parameters.push('hex_batch='+p.hexBatch);
    parameters.push('current_name='+manufacturing_new_guid);
    parameters.push('date_manufacture='+p.lastDiscoverDate);
    parameters.push('version=v'+p.firmware);
    parameters.push('updatedname='+1);
    
    url = 'https://my.mob-mob.com/manufacturer/sync.php?'+(parameters.join("&")).replace(" ", "%20");
    console.log("Manufacturing: GET "+url);
    return http.request(url, {
		method: "GET"
	});
};

window.manufacturing_upload_to_erp = (id, args) => {
    manufacturing_update_step(id, 'start', null);

    if(!isset(manufacturing_periperals[id])) return;
    
    let p = manufacturing_periperals[id];
    let url = "/api/resource/Device/"+manufacturing_new_guid;
	let method = "GET";
    let batch = $("select[name='manufacturing-batch']").val(),
        model = $("select[name='manufacturing-model']").val(),
        batchText = $("select[name='manufacturing-batch'] option[value='" + batch + "']").text(),
        modelText = $("select[name='manufacturing-model'] option[value='" + model + "']").text();
	
	console.log("Manufacturing: manufacturing_password = "+manufacturing_password);
	console.log("Manufacturing: manufacturing_default_password = "+manufacturing_default_password);
	let deviceData = {
	    guid:manufacturing_new_guid,
	    mac_address:p.mac_address,
	    password:manufacturing_password,
	    device_model:modelText,
	    batch:batchText,
	    firmware:p.firmware,
	    manufacture_date:p.lastDiscoverDate,
	    settings:[{
	        setting_type:'default_password',
	        setting:manufacturing_default_password
	    }]
	};
        
	return new Promise(function(resolve, reject) {
        http.request(url, {
    	    method: method
    	}).then((rs)=>{
    	    method = "PUT";
    	    return http.request(url, {
        		method: method,
        		serializer: 'json',
        		data:{data:deviceData},
        	})
    	}, (error)=>{
    	    url = "/api/resource/Device";
    	    method = "POST";
    	    return http.request(url, {
        		method: method,
        		serializer: 'json',
        		data:{data:deviceData},
        	});
    	}).then((rs)=>{
    		resolve();
    	})
	});
};

window.manufacturing_clean_discovery_list = () => {
    $('.manufacturing-peripheral').remove();
};


window.manufacturing_toggle_show_done = (params) => {
    if(params.obj.is(':checked')){
    }else{
        $('.manufacturing-peripheral.device').each(function(){
            if($(this).find('.item-content').attr('model').toLowerCase()!='bg000'){
                $(this).remove();
            } 
        });
    }
};


window.manufacturing_toggle_show_all = (params) => {
    if(params.obj.is(':checked')){
    }else{
        $('.manufacturing-peripheral.device').each(function(){
            if($(this).find('.item-content').attr('rssi')*1 < -60){
                $(this).remove();
            } 
        });
    }
};
