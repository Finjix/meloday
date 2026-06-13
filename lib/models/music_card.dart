class MusicCard {
  final String id;
  String name;
  final String summary;
  final String fullContent;
  final String coverImage;
  final String musicFile;
  final DateTime createdAt;
  final List<String> tags;
  final String moodColor;

  MusicCard({
    required this.id,
    required this.name,
    required this.summary,
    required this.fullContent,
    required this.coverImage,
    required this.musicFile,
    required this.createdAt,
    required this.tags,
    required this.moodColor,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'summary': summary,
        'fullContent': fullContent,
        'coverImage': coverImage,
        'musicFile': musicFile,
        'createdAt': createdAt.toIso8601String(),
        'tags': tags,
        'moodColor': moodColor,
      };

  factory MusicCard.fromJson(Map<String, dynamic> json) => MusicCard(
        id: json['id'] as String,
        name: json['name'] as String,
        summary: json['summary'] as String,
        fullContent: json['fullContent'] as String,
        coverImage: json['coverImage'] as String,
        musicFile: json['musicFile'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        tags: List<String>.from(json['tags'] as List),
        moodColor: json['moodColor'] as String,
      );
}
