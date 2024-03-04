window.device_network_component = {
  template: /*html*/ `
      <div class="container" v-cloak>
          <a ref="fixedMenu" href="#" class="link icon-only" @click="fixedNetwork">
              <i class="icon material-icons">construction</i>
          </a>
          <a ref="sortMenu" href="#" class="link icon-only" @click="toggleSort">
              <i class="icon material-icons">{{ sortableIcon }}</i>
          </a>
          <div ref="list" v-if="profileDevice.length > 1" class="list media-list no-margin list-group sortable sortable-network-wrapper no-more-class" @sortable:sort="onSortableSort" data-sortable-move-elements="false">
              <ul>
                  <template v-for="item in profileDevice" :key="item.isGroup ? item.groupName : item.name">
                      <li :class="{ 'list-group-title': true, 'no-sorting': item.noSorting, 'swipeout': true }" v-if="item.isGroup">
                        <div class="swipeout-content">{{ item.groupName }}</div>
                      </li>

                      <li :class="['home-scanned-peripheral', 'device', item.network_id === '0' ? 'swipeout' : '']" :guid="item.device" signal="0" is-network="true" v-else>
                          <div class="item-content swipeout-content">
                              
                              <label v-show="isSorting" class="checkbox p-2 mx-1">
                                <!-- checkbox input -->
                                <input type="checkbox" v-model="item.checked" @click="item.checked = !item.checked" />
                                <!-- checkbox icon -->
                                <i class="icon-checkbox" style="opacity: 1;"></i>
                              </label>

                              <div class="item-media" style="position:relative;">
                                  <img :src="parseImage(item)" width="60" />
                                  <i class="material-icons mesh-head" style="position:absolute;left:-5px;bottom:-5px;font-size:20px;display:none;">link</i>
                                  <i class="material-icons mesh-tail" style="position:absolute;right:-5px;bottom:-5px;font-size:20px;display:none;">link</i>
                              </div>
                              <div class="item-inner">
                                  <div class="item-title-row">
                                      <div class="item-title">{{ item.device_model }} - <span class="text-muted" style="font-size: 14px;">{{ item.device_name.substring(0, 12) }}</span></div>
                                  </div>
                                  <div class="item-subtitle text-muted">{{ item.subdeviceNameList }}</div>
                                  <div class="signal-panel item-text height-21">
                                      <div>
                                          <div class="signal"></div>
                                          <div class="bluetooth"></div>
                                          <div class="mesh" :pos="calcMeshSize(item.network_id)"></div>
                                          <div class="mobmob"></div>
                                          <div class="iostatus"></div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                          <div class="sortable-handler" style="padding-left:10px; padding-right:10px;"></div>
                      </li>
                  </template>

                  <li style="height: 20px;" class="sort-end"></li>
              </ul>
          </div>
          <div v-else>
            <div class="device-create">
              <div class="block" style="text-align:center;">
                <span class="material-icons" style="font-size:100px;color:#ddd;">meeting_room</span>
                <p>You don\'t have any devices, create one.</p>
              </div>
              <div class="block block-strong">
                <p class="row">
                  <a class="col button button-large" href="#">Create Device</a>
                </p>
              </div>
            </div>
          </div>
      </div>
      `,
  data: () => {
    return {
      profileDevice: [],
      isSorting: false,
      updatedNetworkIds: {},
      unassignedDevices: [],
    };
  },
  mounted: function () {
    try {
      document.querySelector('.frappe-detail-right').appendChild(this.$refs.fixedMenu);
      document.querySelector('.frappe-detail-right').appendChild(this.$refs.sortMenu);
    } catch (err) {
      // ignore
    }

    this.getProfile();

    this.startScan();
  },
  beforeDestroy() {
    try {
      $(this.$refs.sortMenu).remove();
    } catch (err) {
      // ignore
    }

    this.stopScan();
  },
  computed: {
    sortableIcon: function () {
      return this.isSorting ? 'done' : 'sort';
    },
  },
  watch: {
    isSorting: function (newVal) {
      if (!this.$refs.list) return;

      if (newVal) {
        app.sortable.enable(this.$refs.list);

        this.updatedNetworkIds = {};
        this.unassignedDevices = this.profileDevice.filter((e) => e.network_id === '0' && !e.isGroup).map((e) => app.utils.extend({}, e));
      } else {
        app.sortable.disable(this.$refs.list);

        this.updateDeviceNetwork();
      }
    },
  },
  methods: {
    getProfile: function () {
      // app.preloader.show();
      // http
      //   .request(encodeURI('/api/resource/Profile/' + erp.info.profile.name), {
      //     method: 'GET',
      //     responseType: 'json',
      //   })
      //   .then((rs) => {
      //     if (rs.data && rs.data.data.profile_device) {
      //       const profile_device = rs.data.data.profile_device;
      //       const profile_subdevice = rs.data.data.profile_subdevice;

      //       this.profileDevice = this.groupNetworkDevice(profile_device, profile_subdevice);
      //     }

      //     app.preloader.hide();
      //   })
      //   .catch(() => {
      //     app.preloader.hide();
      //   });
      const profile = app.utils.extend({}, erp.info.profile);

      const profile_device = profile.profile_device;
      const profile_subdevice = profile.profile_subdevice;

      this.profileDevice = this.groupNetworkDevice(profile_device, profile_subdevice);
    },
    groupNetworkDevice: function (profileDevice, profileSubdevice) {
      const map = {};
      profileDevice.forEach((device) => {
        device.network_id = device.network_id || '0';
        const groupName = device.network_id || '0';
        if (!map[groupName]) {
          map[groupName] = [];
        }

        map[groupName].push(device);
      });

      const keys = Object.keys(map).sort((a, b) => {
        a = parseInt(a);
        b = parseInt(b);
        if (a === 0) {
          return 1;
        } else if (b === 0) {
          return -1;
        } else {
          return a - b;
        }
      });

      // sort position
      keys.forEach((e) => {
        const devices = map[e];

        devices.sort((a, b) => {
          return a.network_position - b.network_position;
        });
      });

      const arr = [];
      // New Network
      arr.push({
        network_id: this.createNextNetworkId(profileDevice),
        isGroup: true,
        groupName: _('New Network'),
        noSorting: true,
      });

      // New Network
      keys.forEach((e) => {
        arr.push({
          network_id: e,
          isGroup: true,
          groupName: e === '0' ? _('Unassigned') : _('Network') + ' ' + e,
        });

        const devices = map[e];
        devices.forEach((e) => {
          const subdevices = profileSubdevice.filter((e2) => e2.profile_device === e.name).map((e2) => `${tran(e2.room_name)}-${e2.title}`);

          arr.push({
            ...e,
            subdeviceNameList: subdevices.join(','),
            isGroup: false,
            checked: false,
          });
        });
      });

      // No Unassigned, must create
      if (arr.findIndex((e) => e.network_id === '0') === -1) {
        arr.push({
          network_id: '0',
          isGroup: true,
          groupName: _('Unassigned'),
        });
      }
      return arr;
    },
    parseImage: function (item) {
      const guid = item.device;
      const hexid = guid.substring(guid.length - 6, guid.length - 2);
      const model = erp.doctype.device_model[hexid.toUpperCase()];

      if (!model || !model.image) {
        return '';
      }

      return frappe_get_url(model.image);
    },
    onSortableSort: function (event) {
      const from = event.detail.from;
      const to = event.detail.to;

      const fromDevice = this.profileDevice[from];
      const toDevice = this.profileDevice[to];

      // record update
      this.updatedNetworkIds[fromDevice.network_id] = true;
      if (!toDevice.isGroup) {
        this.updatedNetworkIds[toDevice.network_id] = true;
      }

      // console.log('sort >>>> from: ' + from + '; to: ' + to, fromDevice, toDevice);

      if (from < to) {
        // _ _ _ _ _ _ _ _ _ _  ->  _ _ _ _ _ _ _ _ _  ->  _ _ _ _ _ _ _ _ _ _ _
        //   f       t                        t                    t f
        const network_id = toDevice.network_id;
        const arr = this.profileDevice
          .filter((e) => {
            return e.network_id === network_id && !e.isGroup && e.name !== fromDevice.name;
          })
          .sort((a, b) => {
            return a.network_position - b.network_position;
          });
        if (toDevice.isGroup) {
          arr.unshift(fromDevice);
        } else {
          const index = arr.findIndex((e) => e.name === toDevice.name);
          arr.splice(index + 1, 0, fromDevice);
        }

        fromDevice.network_id = network_id;
        arr.forEach((e, index) => {
          e.network_position = index;
        });
      } else {
        // _ _ _ _ _ _ _ _ _ _  ->  _ _ _ _ _ _ _ _ _  ->  _ _ _ _ _ _ _ _ _ _
        //   t     f                  t                      f t
        const toPrevDevice = this.profileDevice[to - 1];
        const network_id = toPrevDevice.network_id;
        const arr = this.profileDevice
          .filter((e) => {
            return e.network_id === network_id && !e.isGroup && e.name !== fromDevice.name;
          })
          .sort((a, b) => {
            return a.network_position - b.network_position;
          });
        if (toPrevDevice.isGroup) {
          arr.unshift(fromDevice);
        } else {
          const index = arr.findIndex((e) => e.name === toPrevDevice.name);
          arr.splice(index + 1, 0, fromDevice);
        }

        fromDevice.network_id = network_id;
        arr.forEach((e, index) => {
          e.network_position = index;
        });
      }

      // record update
      this.updatedNetworkIds[fromDevice.network_id] = true;
      if (!toDevice.isGroup) {
        this.updatedNetworkIds[toDevice.network_id] = true;
      }

      // ui swap
      this.moveArrayElement(this.profileDevice, from, to);
    },
    moveArrayElement: function (array, from, to) {
      // 将from位置的元素删除并保存
      const element = array.splice(from, 1)[0];
      // 根据from和to的关系来决定插入位置
      array.splice(to, 0, element);
    },
    createNextNetworkId: function (devices) {
      let nextNetworkId = 0;
      devices.forEach((e) => {
        const id = parseInt(e.network_id);
        if (id > nextNetworkId) {
          nextNetworkId = id;
        }
      });
      return `${nextNetworkId + 1}`;
    },
    createTaskPromise: function (command) {
      return function () {
        return new Promise((resolve, reject) => {
          console.log('tasking: ', command);
          const mac = core_utils_get_mac_address_from_guid(command.guid);

          const toast = app.toast.create({
            position: 'center',
            text: `${_('Update')} ${command.profileDevice.device_model} <br /> ${command.profileDevice.subdeviceNameList} ${mac}...`,
          });

          toast.open();

          // let connectTimeout = null;

          iot_ble_check_enable()
            // .then(() => {
            //     // connectTimeout = setTimeout(() => {
            //     //     reject(new Error("Connect Timeout"));
            //     // }, 10000);
            //     // return iot_ble_do_pre_action(command.guid);
            // })
            .then(() => {
              return new Promise((_res, _rej) => {
                const bytes = command.bytes;
                const device_guid = command.guid;
                const cmd = [
                  {
                    action: 'connect',
                  },
                ];

                cmd.push(
                  ...bytes.map((e) => {
                    return {
                      action: 'write',
                      data: e,
                    };
                  }),
                );
                cmd.push({
                  action: 'write',
                  data: '810e',
                });

                console.log('>>>>>> cmd: ', cmd);
                if(!isset(window.scanned_periperals)){
                  window.scanned_periperals = {};
                }
                const p = Object.keys(scanned_periperals).find((e) => scanned_periperals[e].guid === device_guid);

                if (p) {
                  ha_process_periperal_cmd(p, cmd, true).then(_res, _rej);
                } else {
                  _rej(new Error('Device not here'));
                }
              });
            })
            // .then(() => {
            //     clearTimeout(connectTimeout);
            //     // const writing = [];
            //     ble.startNotification(runtime.peripherals[command.guid].id, "ff80", "ff82", (bytes) => {
            //         console.log(">>> mesh notify " + mac + ": " + bytes);
            //         // if (bytes.startsWith("8500")) {
            //         //     writing.push(bytes);
            //         // } else if (bytes.startsWith("8501")) {
            //         //     writing.push(bytes);
            //         // }

            //         // if (writing.length === 2) {
            //         //     iot_ble_write(command.guid, "ff80", "ff81", "810E", true).then(() => {
            //         //         resolve();
            //         //         clearTimeout(timeout);
            //         //     });
            //         // }
            //     }, () => {
            //         // ignore
            //     });
            // })
            // .then(() => {
            //     const bytes = command.bytes;
            //     const promises = bytes.map((e) => {
            //         return function() {
            //             console.log(">>> mesh write " + mac + ": " + e);
            //             return iot_ble_write(command.guid, "ff80", "ff81", e, false);
            //         };
            //     });

            //     return new Promise((__res, __rej) => {
            //         promises.reduce((prevPromise, nextPromise) => {
            //             return prevPromise.then(nextPromise);
            //         }, Promise.resolve()).then(__res).catch(__rej);
            //     });
            // }).then(() => {
            //     return new Promise((_resolve) => {
            //         setTimeout(() => {
            //             console.log(">>> mesh write " + mac + ": " + "810E");
            //             iot_ble_write(command.guid, "ff80", "ff81", "810E", true).then(_resolve).catch(_resolve);
            //         }, 500);
            //     });
            // })
            .then(() => {
              toast.close();

              // timeout = setTimeout(() => {
              //     reject(new Error("Update Timeout"));
              // }, 3000);

              resolve();
            })
            .catch((err) => {
              toast.close();

              reject(err);
            });
        });
      };
    },
    toggleSort: function () {
      this.isSorting = !this.isSorting;
    },
    fixedNetwork: function(){
      let doms = $(`.home-scanned-peripheral[network_wrong="true"]`);
      doms.forEach((ele)=>{
        let guid = $(ele).attr('guid');
        this.profileDevice.forEach(kitem=>{
          if(!kitem.isGroup && guid == kitem.device){
            console.log(guid);
            kitem.checked = true;
          }
        })
      })
      if(doms.length > 0){
        this.updateDeviceNetwork();
      }else{
        app.toast.show({
          position: 'center',
          text: _('No Device needs fix.'),
          closeTimeout: 2000,
        });

        app.preloader.hide();
      }
      
    },
    calcMeshSize(id) {
      if (id === '0') {
        return 0;
      } else {
        return this.profileDevice.filter((e) => e.network_id === id && !e.isGroup).length;
      }
    },
    // reconnectMesh(id) {
    //   this.updatedNetworkIds[id] = true;
    //   this.updateDeviceNetwork();
    // },
    updateDeviceNetwork: function () {
      app.preloader.show();
      // const updatedIds = Object.keys(this.updatedNetworkIds);
      const updatedDevices = this.profileDevice.filter((e) => e.checked && !e.isGroup);
      console.log(updatedDevices);
      const updatedIds = [];

      return new Promise((resolve, reject) => {
        // if (updatedIds.length <= 0) {
        //   resolve();
        //   return;
        // }

        // update server
        http
          .request(encodeURI('/api/resource/Profile/' + erp.info.profile.name), {
            method: 'PUT',
            responseType: 'json',
            dataType: 'json',
            responseType: 'json',
            serializer: 'json',
            data: {
              profile_device: this.profileDevice.filter((e) => !e.isGroup),
            },
          })
          .then(resolve)
          .catch(reject);
      })
        .then(() => {
          return new Promise((resolve, reject) => {
            if (updatedDevices.length <= 0) {
              resolve();
              return;
            }

            // command bytes: [head, tail]
            const meshCommands = [];

            updatedDevices.forEach((e) => {
              if (e.network_id === '0') {
                meshCommands.push({
                  guid: e.device,
                  bytes: ['8500010000000000000000000000', '850200', '8500010000000000000100000000', '850201'],
                });
              } else {
                if (updatedIds.findIndex((s) => e.network_id === s) === -1) {
                  updatedIds.push(e.network_id);
                }
              }
            });

            updatedIds.forEach((id) => {
              const devices = this.profileDevice
                .filter((e) => {
                  return e.network_id === id && !e.isGroup;
                })
                .sort((a, b) => {
                  return a.network_position - b.network_position;
                });

              console.log('updated devices: ', devices);

              devices.forEach((e, index) => {
                const headBytes =
                  index === 0
                    ? '8500010000000000000000000000'
                    : '850001' + core_utils_get_mac_address_from_guid(devices[index - 1].device, true).toLowerCase() + '00' + '00000000';
                const tailBytes =
                  index === devices.length - 1
                    ? '8500010000000000000100000000'
                    : '850001' + core_utils_get_mac_address_from_guid(devices[index + 1].device, true).toLowerCase() + '01' + '00000000';

                if (e.checked) {
                  meshCommands.push({
                    guid: e.device,
                    bytes: ['85000000', '850200', tailBytes, '850201', headBytes, '850200'],
                  });
                }
              });
            });

            // updatedIds.forEach((id) => {
            //   if (id === '0') {
            //     // check has network to unassigned
            //     const changedDevices = this.profileDevice.filter(
            //       (e) => e.network_id === '0' && !e.isGroup,
            //     );
            //     const updateUnassignDevices = changedDevices.filter((e) => {
            //       const idx = this.unassignedDevices.findIndex((s) => e.name === s.name);
            //       return idx === -1;
            //     });

            //     updateUnassignDevices.forEach((e) => {
            //       meshCommands.push({
            //         guid: e.device,
            //         bytes: [
            //           '8500010000000000000000000000',
            //           '850200',
            //           '8500010000000000000100000000',
            //           '850201',
            //         ],
            //       });
            //     });
            //   } else {
            //     const devices = this.profileDevice
            //       .filter((e) => {
            //         return e.network_id === id && !e.isGroup;
            //       })
            //       .sort((a, b) => {
            //         return a.network_position - b.network_position;
            //       });

            //     devices.forEach((e, index) => {
            //       const headBytes =
            //         index === 0
            //           ? '8500010000000000000000000000'
            //           : '850001' +
            //             core_utils_get_mac_address_from_guid(
            //               devices[index - 1].device,
            //               true,
            //             ).toLowerCase() +
            //             '00' +
            //             '00000000';
            //       const tailBytes =
            //         index === devices.length - 1
            //           ? '8500010000000000000100000000'
            //           : '850001' +
            //             core_utils_get_mac_address_from_guid(
            //               devices[index + 1].device,
            //               true,
            //             ).toLowerCase() +
            //             '01' +
            //             '00000000';

            //       meshCommands.push({
            //         guid: e.device,
            //         bytes: ['85000000', '850200', tailBytes, '850201', headBytes, '850200'],
            //       });
            //     });
            //   }
            // });

            console.log(meshCommands);
            meshCommands.forEach((e) => {
              e.profileDevice = this.profileDevice.find((d) => d.device === e.guid);
            });

            if (meshCommands.length <= 0) {
              resolve();
              return;
            }

            const queue_id = 'queue_' + app.utils.uniqueNumber();
            const queue = core_utils_create_queue(queue_id, false);
            meshCommands.forEach((e) => {
              const t = this.createTaskPromise(e);
              queue.addTask(t);
            });
            let index = 0;
            emitter.on(queue_id, (params) => {
              const error = params.error;
              if (error) {
                reject(error);
              } else {
                index += 1;
                if (index >= meshCommands.length) {
                  resolve();
                }
              }
            });
            queue.start();
          });
        })
        .then(() => {
          return ha_profile_ready();
        })
        .then(() => {
          this.getProfile();

          app.toast.show({
            position: 'center',
            text: _('Update Successfully'),
            closeTimeout: 2000,
          });

          app.preloader.hide();
        })
        .catch((err) => {
          console.log(err);

          app.preloader.hide();

          this.getProfile();

          if (!iot_ble_exception_message(err, false) && !core_server_exception_message(err)) {
            app.dialog.alert(err);
          }
        });
    },
    startScan() {
      ble.stopScan(
        () => {
          ble.startScanWithOptions(
            ['fff0', 'ff70', 'ffB0', 'ff80'],
            {
              reportDuplicates: true,
              scanMode: 'lowLatency',
            },
            (peripheral) => {
              erp.script.ha_discover_ble_peripheral(peripheral);
            },
            () => {
              // this.startScan();
            },
          );
        },
        () => {
          this.startScan();
        },
      );
    },
    stopScan() {
      ble.stopScan(
        function () {},
        function () {},
      );
    },
  },
};
