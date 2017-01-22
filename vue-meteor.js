var VueMeteor = {

    install(Vue, options_) {

        options_ = options_ || {}

        var _init = Vue.prototype._init
        Vue.prototype._init = function(options) {

            if(!this._trackers)
                this._trackers = []

            if(!this._subscriptions)
                this._subscriptions = []

            _init.call(this, options)
        }

        var _destroy = Vue.prototype._destroy
        Vue.prototype._destroy = function() {

            // untrack all
            for(var i = this._trackers.length - 1; i >= 0; i -= 1) {
                this._trackers[i]()
            }

            // unsubscribe all
            for(var i = this._subscriptions.length - 1; i >= 0; i -= 1) {
                this._subscriptions[i].stop()
                this._subscriptions.splice(i, 1)
            }

            _destroy.apply(this, arguments)
        }

        Vue.prototype.$trackMeteor = function(fn, callback) {
            var this_ = this

            var tracker = Tracker.autorun(function() {
                var result = fn.call(this_)

                Tracker.nonreactive(function() {
                    if(typeof callback === 'function') callback.call(this_, result)
                })
            })

            var untrack = function() {
                tracker.stop()

                var idx = this_._trackers.indexOf(untrack)
                if(idx !== -1) this_._trackers.splice(idx, 1)
            }
            this._trackers.push(untrack)

            return untrack
        }

        Vue.prototype.$track = function(fn, callback, options) {

            var optionsDefault = {
                deep: false
            }
            options = Object.assign({}, optionsDefault, options)

            var this_ = this

            var tracker

            var unwatch = this.$watch(function() {
                if(tracker) tracker.stop()

                var result

                var watcher = true

                tracker = Tracker.autorun(function() {
                    result = fn.call(this_)

                    if(!watcher) { // tracker was triggered directly (not through watcher)
                        Tracker.nonreactive(function() {
                            if(typeof callback === 'function') callback.call(this_, result)
                        })
                    }
                })

                watcher = false

                return result
            }, function(result) {
                if(typeof callback === 'function') callback.call(this_, result)
            }, { deep: options.deep, immediate: true })

            // create function to stop tracker and add it to _trackers array for later teardown
            var untrack = function() {
                unwatch()
                tracker.stop()

                var idx = this_._trackers.indexOf(untrack)
                if(idx !== -1) this_._trackers.splice(idx, 1)
            }
            this._trackers.push(untrack)

            return untrack
        }

        Vue.mixin({
            created() {
                var dataMeteor = this.$options.dataMeteor

                if(!dataMeteor) return

                for(var key in dataMeteor) {
                    Vue.util.defineReactive(this, key, null)
                    this.$trackMeteor(dataMeteor[key], (function(key) {
                        return function(result) {
                            this[key] = result
                        }
                    })(key))
                }
            }
        })
        Vue.config.optionMergeStrategies.dataMeteor = Vue.config.optionMergeStrategies.computed

        Vue.mixin({
            created() {
                var dataReactive = this.$options.dataReactive

                if(!dataReactive) return

                for(var key in dataReactive) {
                    Vue.util.defineReactive(this, key, null)
                    this.$track(dataReactive[key], (function(key) {
                        return function(result) {
                            this[key] = result
                        }
                    })(key))
                }
            }
        })
        Vue.config.optionMergeStrategies.dataReactive = Vue.config.optionMergeStrategies.computed

        Vue.mixin({
            methods: {
                $subscribe() {
                    var subscription = Meteor.subscribe.apply(this, arguments)
                    this._subscriptions.push(subscription)

                    var this_ = this

                    var stop = subscription.stop
                    subscription.stop = function() {
                        stop.call(subscription)
                        var idx = this_._subscriptions.indexOf(subscription)
                        if(idx !== -1) this_._subscriptions.splice(idx, 1)
                    }

                    return subscription
                }
            }
        })

    }

}

module.exports = VueMeteor
