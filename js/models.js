/* global WP_API_Settings:false */
// Suppress warning about parse function's unused "options" argument:
/* jshint unused:false */
(function( wp, WP_API_Settings, Backbone, window, undefined ) {

	'use strict';

	/**
	 * Array of parseable dates.
	 *
	 * @type {string[]}.
	 */
	var parseable_dates = [ 'date', 'modified', 'date_gmt', 'modified_gmt' ];

	/**
	 * Mixin for all content that is time stamped.
	 *
	 * @type {{toJSON: toJSON, parse: parse}}.
	 */
	var TimeStampedMixin = {
		/**
		 * Serialize the entity pre-sync.
		 *
		 * @returns {*}.
		 */
		toJSON: function() {
			var attributes = _.clone( this.attributes );

			// Serialize Date objects back into 8601 strings.
			_.each( parseable_dates, function( key ) {
				if ( key in attributes ) {
					attributes[key] = attributes[key].toISOString();
				}
			});

			return attributes;
		},

		/**
		 * Unserialize the fetched response.
		 *
		 * @param {*} response.
		 * @returns {*}.
		 */
		parse: function( response ) {

			// Parse dates into native Date objects.
			_.each( parseable_dates, function ( key ) {
				if ( ! ( key in response ) ) {
					return;
				}

				var timestamp = wp.api.utils.parseISO8601( response[key] );
				response[key] = new Date( timestamp );
			});

			// Parse the author into a User object.
			if ( 'undefined' !== typeof response.author ) {
				response.author = new wp.api.models.User( response.author );
			}

			return response;
		}
	};

	/**
	 * Mixin for all hierarchical content types such as posts.
	 *
	 * @type {{parent: parent}}.
	 */
	var HierarchicalMixin = {
		/**
		 * Get parent object.
		 *
		 * @returns {Backbone.Model}
		 */
		parent: function() {

			var object, parent = this.get( 'parent' );

			// Return null if we don't have a parent.
			if ( parent === 0 ) {
				return null;
			}

			var parentModel = this;

			if ( 'undefined' !== typeof this.parentModel ) {
				/**
				 * Probably a better way to do this. Perhaps grab a cached version of the
				 * instantiated model?
				 */
				parentModel = new this.parentModel();
			}

			// Can we get this from its collection?
			if ( parentModel.collection ) {
				return parentModel.collection.get( parent );
			} else {

				// Otherwise, get the object directly.
				object = new parentModel.constructor( {
					id: parent
				});

				// Note that this acts asynchronously.
				object.fetch();

				return object;
			}
		}
	};

	/**
	 * Private Backbone base model for all models.
	 */
	var WPApiBaseModel = Backbone.Model.extend(
		/** @lends WPApiBaseModel.prototype  */
		{
			/**
			 * Set nonce header before every Backbone sync.
			 *
			 * @param {string} method.
			 * @param {Backbone.Model} model.
			 * @param {{beforeSend}, *} options.
			 * @returns {*}.
			 */
			sync: function( method, model, options ) {
				options = options || {};

				if ( 'undefined' !== typeof WP_API_Settings.nonce ) {
					var beforeSend = options.beforeSend;

					options.beforeSend = function( xhr ) {
						xhr.setRequestHeader( 'X-WP-Nonce', WP_API_Settings.nonce );

						if ( beforeSend ) {
							return beforeSend.apply( this, arguments );
						}
					};
				}

				return Backbone.sync( method, model, options );
			}
		}
	);

	/**
	 * Backbone model for a single user.
	 *
	 *
	 * @param {Object} options
	 * @param {int}    options.id The user id. Optional. Defaults to 'me', fetching the current user.
	 */
	wp.api.models.User = WPApiBaseModel.extend(
		/** @lends User.prototype  */
		{
			idAttribute: 'id',

			urlRoot: WP_API_Settings.root + 'wp/v2/users',

			defaults: {
				id: 'me',
				avatar_url: {},
				capabilities: {},
				description: '',
				email: '',
				extra_capabilities: {},
				first_name: '',
				last_name: '',
				link: '',
				name: '',
				nickname: '',
				registered_date: new Date(),
				roles: [],
				slug: '',
				url: '',
				username: '',
				_links: {}
			}
		}
	);

	/**
	 * Model for a single taxonomy.
	 *
	 * @param {Object} options
	 * @param {string} options.slug The taxonomy slug.
	 */
	wp.api.models.Taxonomy = WPApiBaseModel.extend(
		/** @lends Taxonomy.prototype  */
		{
			idAttribute: 'slug',

			urlRoot: WP_API_Settings.root + 'wp/v2/taxonomies',

			defaults: {
				name: '',
				slug: null,
				description: '',
				labels: {},
				types: [],
				show_cloud: false,
				hierarchical: false
			}
		}
	);

	/**
	 * Backbone model for a single term.
	 *
	 * @param {Object} options
	 * @param {int} id The term id.
	 */
	wp.api.models.Term = WPApiBaseModel.extend(
		/** @lends Term.prototype */
		{
			idAttribute: 'id',

			urlRoot: WP_API_Settings.root + 'wp/v2/terms/tag',

			defaults: {
				id: null,
				name: '',
				slug: '',
				description: '',
				parent: null,
				count: 0,
				link: '',
				taxonomy: '',
				_links: {}
			}

		}
	);

	/**
	 * Backbone model for a single post.
	 *
	 * @param {Object} options
	 * @param {int}    options.id The post id.
	 */
	wp.api.models.Post = WPApiBaseModel.extend( _.extend(
		/** @lends Post.prototype  */
		{
			idAttribute: 'id',

			urlRoot: WP_API_Settings.root + 'wp/v2/posts',

			defaults: {
				id: null,
				date: new Date(),
				date_gmt: new Date(),
				guid: {},
				link: '',
				modified: new Date(),
				modified_gmt: new Date(),
				password: '',
				type: 'post',
				title: {},
				content: {},
				author: null,
				excerpt: {},
				featured_image: null,
				comment_status: 'open',
				ping_status: 'open',
				sticky: false,
				format: 'standard',
				_links: {}
			}
		}, TimeStampedMixin, HierarchicalMixin )
	);

	/**
	 * Backbone model for a single page.
	 *
	 * @param {Object} options
	 * @param {int}    options.id The page id.
	 */
	wp.api.models.Page = WPApiBaseModel.extend( _.extend(
		/** @lends Page.prototype  */
		{
			idAttribute: 'id',

			urlRoot: WP_API_Settings.root + 'wp/v2/pages',

			defaults: {
				id: null,
				date: new Date(),
				date_gmt: new Date(),
				guid: {},
				link: '',
				modified: new Date(),
				modified_gmt: new Date(),
				password: '',
				slug: '',
				type: 'page',
				title: {},
				content: {},
				author: null,
				excerpt: {},
				featured_image: null,
				comment_status: 'closed',
				ping_status: 'closed',
				menu_order: null,
				template: '',
				_links: {}
			}
		}, TimeStampedMixin, HierarchicalMixin )
	);

	/**
	 * Backbone model for a single post revision.
	 *
	 * @param {Object} options
	 * @param {int}    options.parent The id of the post that this revision belongs to.
	 * @param {int}    options.id     The revision id.
	 */
	wp.api.models.PostRevision = WPApiBaseModel.extend( _.extend(
		/** @lends PostRevision.prototype */
		{
			idAttribute: 'id',

			defaults: {
				id: null,
				author: null,
				date: new Date(),
				date_gmt: new Date(),
				guid: {},
				modified: new Date(),
				modified_gmt: new Date(),
				parent: 0,
				slug: '',
				title: {},
				content: {},
				excerpt: {},
				_links: {}
			},

			/**
			 * Return URL for the model.
			 *
			 * @returns {string}.
			 */
			url: function() {
				var id     = this.get( 'id' )     || '',
					parent = this.get( 'parent' ) || '';

				return WP_API_Settings.root + 'wp/v2/posts/' + parent + '/revisions/' + id;
			}

		}, TimeStampedMixin, HierarchicalMixin )
	);

	/**
	 * Backbone model for a single media item.
	 *
	 * @param {Object} options
	 * @param {int}    options.id The media item id.
	 */
	wp.api.models.Media = WPApiBaseModel.extend( _.extend(
		/** @lends Media.prototype */
		{
			idAttribute: 'id',

			urlRoot: WP_API_Settings.root + 'wp/v2/media',

			defaults: {
				id: null,
				date: new Date(),
				date_gmt: new Date(),
				guid: {},
				link: '',
				modified: new Date(),
				modified_gmt: new Date(),
				password: '',
				slug: '',
				type: 'attachment',
				title: {},
				author: null,
				comment_status: 'open',
				ping_status: 'open',
				alt_text: '',
				caption: '',
				description: '',
				media_type: '',
				media_details: {},
				post: null,
				source_url: '',
				_links: {}
			}

		}, TimeStampedMixin )
	);

	/**
	 * Backbone model for a single comment.
	 *
	 * @param {Object} options
	 * @param {int}    options.id The comment id.
	 */
	wp.api.models.Comment = WPApiBaseModel.extend( _.extend(
		/** @lends Comment.prototype */
		{
			idAttribute: 'id',

			urlRoot: WP_API_Settings.root + 'wp/v2/comments',


			defaults: {
				id: null,
				author: null,
				author_email: '',
				author_ip: '',
				author_name: '',
				author_url: '',
				author_user_agent: '',
				content: {},
				date: new Date(),
				date_gmt: new Date(),
				karma: 0,
				link: '',
				parent: 0,
				type: '',
				_links: {}
			}

		}, TimeStampedMixin, HierarchicalMixin )
	);

	/**
	 * Backbone model for a single post type.
	 *
	 * @param {Object} options
	 * @param {string} options.slug The post type slug.
	 */
	wp.api.models.PostType = WPApiBaseModel.extend(
		/** @lends PostType.prototype */
		{
			idAttribute: 'slug',

			urlRoot: WP_API_Settings.root + 'wp/v2/types',

			defaults: {
				slug: null,
				name: '',
				description: '',
				labels: {},
				hierarchical: false
			},

			/**
			 * Prevent model from being saved.
			 *
			 * @returns {boolean}.
			 */
			save: function() {
				return false;
			},

			/**
			 * Prevent model from being deleted.
			 *
			 * @returns {boolean}.
			 */
			destroy: function() {
				return false;
			}
		}
	);

	/**
	 * Backbone model for a a single post status.
	 *
	 * @param {Object} options
	 * @param {string} options.slug The post status slug.
	 */
	wp.api.models.PostStatus = WPApiBaseModel.extend(
		/** @lends PostStatus.prototype */
		{
			idAttribute: 'slug',

			urlRoot: WP_API_Settings.root + 'wp/v2/statuses',

			defaults: {
				slug: null,
				name: '',
				'public': true,
				'protected': false,
				'private': false,
				queryable: true,
				show_in_list: true,
				_links: {}
			},

			/**
			 * Prevent model from being saved.
			 *
			 * @returns {boolean}.
			 */
			save: function() {
				return false;
			},

			/**
			 * Prevent model from being deleted.
			 *
			 * @returns {boolean}.
			 */
			destroy: function() {
				return false;
			}
		}
	);

	/**
	 * API Schema model. Contains meta information about the API.
	 */
	wp.api.models.Schema = WPApiBaseModel.extend(
		/** @lends Shema.prototype  */
		{
			url: WP_API_Settings.root + 'wp/v2',

			defaults: {
				namespace: '',
				_links: '',
				routes: {}
			},

			/**
			 * Prevent model from being saved.
			 *
			 * @returns {boolean}.
			 */
			save: function() {
				return false;
			},

			/**
			 * Prevent model from being deleted.
			 *
			 * @returns {boolean}.
			 */
			destroy: function() {
				return false;
			}
		}
	);


})( wp, WP_API_Settings, Backbone, window );
